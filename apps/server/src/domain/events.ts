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

/** Creates an event. It must start in the future. */
export async function createEvent(
  guild: Guild,
  input: CreateEventInput,
  createdBy: User,
  now = new Date(),
): Promise<Event> {
  const event = parse(createEventSchema, input);
  checkStartsInFuture(event.startsAt, now);
  return Event.create({
    guildId: guild.id,
    type: event.type,
    ...columns(event),
    createdByUserId: createdBy.id,
  });
}

/**
 * Changes an upcoming event: everything but its type. Started and cancelled events can't
 * change. Its new time must still be in the future.
 */
export async function updateEvent(
  guild: Guild,
  eventId: string,
  input: UpdateEventInput,
  now = new Date(),
): Promise<Event> {
  const details = parse(updateEventSchema, input);
  return transaction(async () => {
    const event = await changeableEvent(guild, eventId, now);
    // The slots follow the rules of the event's type, which the body doesn't carry.
    const issues = eventSlotIssues(event.type, details);
    if (issues.length > 0) throw new DomainValidationError(issues);
    checkStartsInFuture(details.startsAt, now);
    return event.update(columns(details));
  });
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

function parse<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) throw new DomainValidationError(toValidationIssues(result.error, input));
  return result.data;
}

function checkStartsInFuture(startsAt: string, now: Date): void {
  if (new Date(startsAt) <= now) {
    throw new DomainValidationError([{ field: 'startsAt', code: EVENT_ERROR_CODES.startsInPast }]);
  }
}

function columns(details: z.output<typeof updateEventSchema>) {
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
