import { COMBAT_ROLES } from '@wgm/shared';
import { Op, Transaction } from 'sequelize';

import { Event, Guild, SignUp } from '../db/models/index.js';
import { transaction } from '../db/transaction.js';
import { noSignUpChanges, type SignUpChanges } from './sign-ups.js';

const HOUR = 60 * 60 * 1000;

/**
 * An event's Tentative deadline is stored (`tentativeDeadlineAt`), not worked out each time:
 * changing the guild's setting keeps an event's deadline when the new one would already have
 * passed, so nobody is replaced just because a setting changed.
 */
export function deadlineFor(
  event: Pick<Event, 'startsAt' | 'tentativeDeadlineHours'>,
  guild: Pick<Guild, 'tentativeDeadlineHours'>,
): Date {
  const hours = event.tentativeDeadlineHours ?? guild.tentativeDeadlineHours;
  return new Date(event.startsAt.getTime() - hours * HOUR);
}

/** When the reminder goes out: the guild's reminder time before the event's deadline. */
export function reminderAt(
  event: Pick<Event, 'tentativeDeadlineAt'>,
  guild: Pick<Guild, 'reminderHours'>,
): Date {
  return new Date(event.tentativeDeadlineAt.getTime() - guild.reminderHours * HOUR);
}

/** After the deadline, only Confirmed sign-ups are taken. */
export function tentativeClosed(event: Pick<Event, 'tentativeDeadlineAt'>, now = new Date()) {
  return event.tentativeDeadlineAt <= now;
}

/** How many hours before the start the event's deadline is. */
export function deadlineHours(event: Pick<Event, 'startsAt' | 'tentativeDeadlineAt'>): number {
  return Math.round((event.startsAt.getTime() - event.tentativeDeadlineAt.getTime()) / HOUR);
}

/**
 * After the guild's deadline setting changes: upcoming events without their own deadline move
 * to the new one, unless it would already have passed. Resolves the events that moved.
 */
export async function applyGuildDeadline(guild: Guild, now = new Date()): Promise<string[]> {
  const events = await Event.findAll({
    where: {
      guildId: guild.id,
      startsAt: { [Op.gt]: now },
      cancelledAt: null,
      tentativeDeadlineHours: null,
    },
  });
  const moved = [];
  for (const event of events) {
    const deadline = deadlineFor(event, guild);
    if (deadline <= now || deadline.getTime() === event.tentativeDeadlineAt.getTime()) continue;
    await event.update({ tentativeDeadlineAt: deadline });
    moved.push(event.id);
  }
  return moved;
}

/**
 * The Tentative participants (in a slot) who haven't had the reminder, if it's time: after the
 * reminder time and before the deadline. Marks them as reminded, so each gets it once.
 */
export async function takeReminders(eventId: string, now = new Date()): Promise<SignUp[]> {
  return transaction(async () => {
    const event = await Event.findByPk(eventId, { include: [{ model: Guild, as: 'guild' }] });
    if (!event || event.cancelledAt || tentativeClosed(event, now)) return [];
    // A job left from before the deadline moved later does nothing.
    if (reminderAt(event, event.guild!) > now) return [];
    const signUps = await SignUp.findAll({
      where: { eventId, status: 'tentative', placement: 'slot', remindedAt: null },
      lock: Transaction.LOCK.UPDATE,
    });
    for (const signUp of signUps) await signUp.update({ remindedAt: now });
    return signUps;
  });
}

/**
 * At the deadline: in each role, Tentative participants are replaced by the earliest waitlisted
 * characters, the most recent Tentative sign-ups first, and move to the end of the waitlist.
 * Those with nobody to replace them keep their spot. Does nothing for a cancelled event, or
 * when the deadline hasn't come (a job left from before it moved).
 */
export async function replaceAtDeadline(eventId: string, now = new Date()): Promise<SignUpChanges> {
  return transaction(async () => {
    const changes = noSignUpChanges();
    const event = await Event.findByPk(eventId, { lock: Transaction.LOCK.UPDATE });
    if (!event || event.cancelledAt || !tentativeClosed(event, now)) return changes;
    const signUps = await SignUp.findAll({
      where: { eventId, placement: { [Op.ne]: null } },
      order: [
        ['signedUpAt', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    for (const role of COMBAT_ROLES) {
      const tentative = signUps
        .filter((s) => s.role === role && s.placement === 'slot' && s.status === 'tentative')
        .reverse();
      const waitlist = signUps.filter((s) => s.role === role && s.placement === 'waitlist');
      const swaps = Math.min(tentative.length, waitlist.length);
      for (let index = 0; index < swaps; index++) {
        const [out, into] = [tentative[index]!, waitlist[index]!];
        // One millisecond apart, so the replaced keep their order at the end of the waitlist.
        await out.update({ placement: 'waitlist', signedUpAt: new Date(now.getTime() + index) });
        await into.update({ placement: 'slot' });
        changes.promoted.push(into.id);
        changes.replaced.push(out.id);
      }
    }
    if (changes.promoted.length > 0) changes.eventIds.push(eventId);
    return changes;
  });
}
