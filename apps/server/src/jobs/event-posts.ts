import { Op } from 'sequelize';

import { Event, Guild } from '../db/models/index.js';
import type { JobEnqueuer } from './queue.js';

/** Asks the worker to bring these events' Discord posts up to date. */
export async function enqueueEventPosts(jobs: JobEnqueuer, eventIds: string[]): Promise<void> {
  await jobs.enqueueMany(
    'event-post',
    eventIds.map((eventId) => ({ eventId })),
  );
}

/** How long sign-ups are gathered into one edit of an event's post. */
export const POST_EDIT_WINDOW_MS = 3000;

/**
 * After a sign-up: updates the event's post at the end of the current window. Every sign-up in
 * the window lands on the same job (its ID has the window), which reads the final state, so a
 * burst of sign-ups edits the post once per window instead of once each. The window is in the
 * ID because BullMQ ignores a job whose ID is running: a sign-up during the edit is in the next
 * window and gets its own job.
 */
export async function scheduleEventPostUpdate(
  jobs: JobEnqueuer,
  eventId: string,
  now = Date.now(),
): Promise<void> {
  const window = Math.floor(now / POST_EDIT_WINDOW_MS) + 1;
  await jobs.enqueueOnce(
    'event-post',
    { eventId },
    { jobId: `event-post-${eventId}-${window}`, runAt: new Date(window * POST_EDIT_WINDOW_MS) },
  );
}

/**
 * After the guild's events channel or Discord language changes: every upcoming event that
 * isn't cancelled is posted again in the new channel, or in the new language.
 */
export async function enqueueUpcomingEventPosts(
  jobs: JobEnqueuer,
  guildId: string,
  now = new Date(),
): Promise<void> {
  const events = await Event.findAll({
    attributes: ['id'],
    where: { guildId, startsAt: { [Op.gt]: now }, cancelledAt: null },
  });
  await enqueueEventPosts(
    jobs,
    events.map((event) => event.id),
  );
}

/**
 * Upcoming events of guilds with an events channel that were never posted: the new events of
 * recurring series, and any whose job was lost. The worker runs it hourly. Posts that failed
 * aren't retried here: retrying a refusal that nobody fixed would only pile up refused calls,
 * which Discord answers by blocking the bot (enqueueFailedEventPosts retries them when
 * something changes). A partial index keeps it to the few events without a post.
 */
export async function enqueueMissingEventPosts(jobs: JobEnqueuer, now = new Date()): Promise<void> {
  const events = await Event.findAll({
    attributes: ['id'],
    where: {
      startsAt: { [Op.gt]: now },
      cancelledAt: null,
      discordMessageId: null,
      discordPostError: null,
    },
    include: [
      { model: Guild, as: 'guild', attributes: [], where: { eventsChannelId: { [Op.ne]: null } } },
    ],
  });
  await enqueueEventPosts(
    jobs,
    events.map((event) => event.id),
  );
}

/**
 * After something in these Discord servers may have given the bot its permissions back (a
 * channel or role changed, the bot's roles did, or the bot reconnected after missing events):
 * retries the posts of upcoming events whose last attempt failed. Only failed posts, so the
 * frequent role changes cost nothing otherwise.
 */
export async function enqueueFailedEventPosts(
  jobs: JobEnqueuer,
  discordServerId: string | string[],
  now = new Date(),
): Promise<void> {
  const events = await Event.findAll({
    attributes: ['id'],
    where: { startsAt: { [Op.gt]: now }, cancelledAt: null, discordPostError: { [Op.ne]: null } },
    include: [{ model: Guild, as: 'guild', attributes: [], where: { discordServerId } }],
  });
  await enqueueEventPosts(
    jobs,
    events.map((event) => event.id),
  );
}
