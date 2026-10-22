import {
  createEventSchema,
  eventSlotIssues,
  EVENT_ERROR_CODES,
  toValidationIssues,
  updateEventSchema,
  type CreateEventInput,
  type UpdateEventInput,
} from '@wgm/shared';
import { Transaction } from 'sequelize';
import type { z } from 'zod';

import { Event, type Guild, type User } from '../db/models/index.js';
import { transaction } from '../db/transaction.js';
import { DomainError, DomainValidationError } from './errors.js';
import { balanceSlots, participantIds, type SignUpChanges } from './sign-ups.js';

/**
 * How many hours before an event Tentative sign-ups close, until story 026 makes it a guild
 * setting with a per-event override.
 */
export const DEFAULT_TENTATIVE_DEADLINE_HOURS = 24;

/** When Tentative participants must have confirmed. */
export function tentativeDeadline(event: Pick<Event, 'startsAt'>): Date {
  return new Date(event.startsAt.getTime() - DEFAULT_TENTATIVE_DEADLINE_HOURS * 60 * 60 * 1000);
}

/** Creates an event. It must start in the future. */
export async function createEvent(
  guild: Guild,
  input: CreateEventInput,
  createdBy: User,
  now = new Date(),
): Promise<Event> {
  const event = parseInput(createEventSchema, input);
  checkStartsInFuture(event.startsAt, now);
  return Event.create({
    guildId: guild.id,
    type: event.type,
    ...eventColumns(event),
    createdByUserId: createdBy.id,
  });
}

/**
 * Changes an upcoming event: everything but its type. Started and cancelled events can't
 * change. Its new time must still be in the future. New slot counts move participants to the
 * waitlist or promote from it, and a new date or time is for telling the participants.
 */
export async function updateEvent(
  guild: Guild,
  eventId: string,
  input: UpdateEventInput,
  now = new Date(),
): Promise<{ event: Event; changes: SignUpChanges }> {
  const details = parseInput(updateEventSchema, input);
  return transaction(async () => {
    const event = await changeableEvent(guild, eventId, now);
    // The slots follow the rules of the event's type, which the body doesn't carry.
    const issues = eventSlotIssues(event.type, details);
    if (issues.length > 0) throw new DomainValidationError(issues);
    checkStartsInFuture(details.startsAt, now);
    const changes = await applyEventChanges(event, eventColumns(details));
    return { event, changes };
  });
}

/**
 * Saves new columns for a locked event and works out what that does to its sign-ups: slots
 * rebalanced, and the participants to tell when the date or time moved.
 */
export async function applyEventChanges(
  event: Event,
  columns: Partial<ReturnType<typeof eventColumns>>,
): Promise<SignUpChanges> {
  const startsAt = event.startsAt.getTime();
  await event.update(columns);
  const changes = await balanceSlots(event);
  if (event.startsAt.getTime() !== startsAt && !event.cancelledAt) {
    for (const memberId of await participantIds(event.id)) {
      changes.rescheduled.push({ memberId, eventId: event.id });
    }
  }
  return changes;
}

/** Cancels an upcoming event. It stays listed, marked with who cancelled it and when. */
export async function cancelEvent(
  guild: Guild,
  eventId: string,
  cancelledBy: User,
  now = new Date(),
): Promise<Event> {
  return transaction(async () => {
    const event = await changeableEvent(guild, eventId, now);
    return event.update({ cancelledAt: now, cancelledByUserId: cancelledBy.id });
  });
}

/** The event, locked; it must not have started or been cancelled. */
async function changeableEvent(guild: Guild, eventId: string, now: Date): Promise<Event> {
  const event = await Event.findOne({
    where: { id: eventId, guildId: guild.id },
    lock: Transaction.LOCK.UPDATE,
  });
  if (!event) throw new DomainError({ code: 'NOT_FOUND' });
  if (event.cancelledAt) throw new DomainError({ code: 'EVENT_CANCELLED' });
  if (event.startsAt <= now) throw new DomainError({ code: 'EVENT_STARTED' });
  return event;
}

/** The parsed input, or a validation error with its issues. */
export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) throw new DomainValidationError(toValidationIssues(result.error, input));
  return result.data;
}

export function checkStartsInFuture(startsAt: string, now: Date): void {
  if (new Date(startsAt) <= now) {
    throw new DomainValidationError([{ field: 'startsAt', code: EVENT_ERROR_CODES.startsInPast }]);
  }
}

/** An event's (or a series') columns from its parsed details. */
export function eventColumns(details: z.output<typeof updateEventSchema>) {
  return {
    name: details.name,
    description: details.description,
    startsAt: new Date(details.startsAt),
    size: details.size,
    tankSlots: details.slots.tank,
    healerSlots: details.slots.healer,
    dpsSlots: details.slots.dps,
  };
}
