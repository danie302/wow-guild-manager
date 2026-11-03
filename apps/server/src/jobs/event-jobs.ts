import { Op } from 'sequelize';

import { Event, Guild } from '../db/models/index.js';
import { missingRoleCheckAt } from '../domain/missing-roles.js';
import { finishedAt } from '../domain/series-posts.js';
import { reminderAt } from '../domain/tentative.js';
import type { JobPayloads } from './definitions.js';
import { JobRunningError, type JobEnqueuer } from './queue.js';

/**
 * Schedules each event's time-based jobs under fixed IDs, so calling it again after a change
 * moves them instead of adding more: the Tentative reminder and deadline
 * (`tentative-reminder-<eventId>`, `tentative-deadline-<eventId>`), the missing-role check
 * (`missing-roles-<eventId>`, skipped when its time has passed), and for an event of a series,
 * posting the next one when it finishes (`series-event-finished-<eventId>`). Cancelled and
 * started events lose the first three; the last one stays, since a cancelled event still holds
 * back the next one until it would have finished. The jobs re-check the data when they run, so
 * an old one that slips through does nothing.
 */
export async function scheduleEventJobs(
  jobs: JobEnqueuer,
  eventIds: string[],
  now = new Date(),
): Promise<void> {
  if (eventIds.length === 0) return;
  const events = await Event.findAll({
    where: { id: eventIds },
    include: [{ model: Guild, as: 'guild', attributes: ['reminderHours'] }],
  });
  for (const event of events) {
    const reminder = `tentative-reminder-${event.id}`;
    const deadline = `tentative-deadline-${event.id}`;
    const check = `missing-roles-${event.id}`;
    const finished = `series-event-finished-${event.id}`;
    if (event.seriesId && finishedAt(event) > now) {
      await scheduleOrAdd(
        jobs,
        'series-event-finished',
        { seriesId: event.seriesId },
        finished,
        finishedAt(event),
      );
    }
    if (event.cancelledAt || event.startsAt <= now) {
      await unscheduleQuietly(jobs, reminder);
      await unscheduleQuietly(jobs, deadline);
      await unscheduleQuietly(jobs, check);
      continue;
    }
    const checkAt = missingRoleCheckAt(event);
    if (checkAt <= now) await unscheduleQuietly(jobs, check);
    else await scheduleOrAdd(jobs, 'missing-role-check', { eventId: event.id }, check, checkAt);
    const data = { eventId: event.id };
    await scheduleOrAdd(
      jobs,
      'tentative-reminder',
      data,
      reminder,
      reminderAt(event, event.guild!),
    );
    await scheduleOrAdd(jobs, 'tentative-deadline', data, deadline, event.tentativeDeadlineAt);
  }
}

/**
 * Removes the two missing-role checks per event (`missing-roles-48-<eventId>` and
 * `missing-roles-24-<eventId>`) that came before the single one, when the worker starts.
 */
export async function removeOldMissingRoleChecks(
  jobs: JobEnqueuer,
  eventIds: string[],
): Promise<void> {
  for (const eventId of eventIds) {
    for (const hours of [48, 24])
      await unscheduleQuietly(jobs, `missing-roles-${hours}-${eventId}`);
  }
}

/** Every guild's upcoming events that aren't cancelled, when the worker starts. */
export async function allUpcomingEventIds(now = new Date()): Promise<string[]> {
  const events = await Event.findAll({
    attributes: ['id'],
    where: { startsAt: { [Op.gt]: now }, cancelledAt: null },
  });
  return events.map((event) => event.id);
}

/** The upcoming events of a guild that aren't cancelled, e.g. after its settings change. */
export async function upcomingEventIds(guildId: string, now = new Date()): Promise<string[]> {
  const events = await Event.findAll({
    attributes: ['id'],
    where: { guildId, startsAt: { [Op.gt]: now }, cancelledAt: null },
  });
  return events.map((event) => event.id);
}

/**
 * Replaces the job under its fixed ID. If that job is running right now, it can't be replaced,
 * so the new one goes under an ID with its time, so it isn't lost.
 */
async function scheduleOrAdd<
  Name extends
    'tentative-reminder' | 'tentative-deadline' | 'missing-role-check' | 'series-event-finished',
>(
  jobs: JobEnqueuer,
  name: Name,
  data: JobPayloads[Name],
  jobId: string,
  runAt: Date,
): Promise<void> {
  try {
    await jobs.schedule(name, data, { jobId, runAt });
  } catch (err) {
    if (!(err instanceof JobRunningError)) throw err;
    await jobs.enqueueOnce(name, data, { jobId: `${jobId}-${runAt.getTime()}`, runAt });
  }
}

async function unscheduleQuietly(jobs: JobEnqueuer, jobId: string): Promise<void> {
  try {
    await jobs.unschedule(jobId);
  } catch (err) {
    // A running job re-checks the event and does nothing for a cancelled one.
    if (!(err instanceof JobRunningError)) throw err;
  }
}
