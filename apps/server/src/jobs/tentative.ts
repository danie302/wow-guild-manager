import { Op } from 'sequelize';

import { Event, Guild } from '../db/models/index.js';
import { reminderAt } from '../domain/tentative.js';
import { JobRunningError, type JobEnqueuer } from './queue.js';

/**
 * Schedules each event's Tentative reminder and deadline jobs, under fixed IDs
 * (`tentative-reminder-<eventId>`, `tentative-deadline-<eventId>`), so calling it again after a
 * change moves them instead of adding more. Cancelled and started events lose theirs. The jobs
 * re-check the event when they run, so an old one that slips through does nothing.
 */
export async function scheduleTentativeJobs(
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
    if (event.cancelledAt || event.startsAt <= now) {
      await unscheduleQuietly(jobs, reminder);
      await unscheduleQuietly(jobs, deadline);
      continue;
    }
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
async function scheduleOrAdd(
  jobs: JobEnqueuer,
  name: 'tentative-reminder' | 'tentative-deadline',
  data: { eventId: string },
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
