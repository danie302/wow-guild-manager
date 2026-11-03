import { Op, literal } from 'sequelize';

import { Event } from '../db/models/index.js';

const HOUR = 60 * 60 * 1000;

/** An event counts as finished this long after it starts (there's no end time). */
export const FINISHED_AFTER_HOURS = 12;

/** When the event counts as finished, whether or not it was cancelled. */
export function finishedAt(event: Pick<Event, 'startsAt'>): Date {
  return new Date(event.startsAt.getTime() + FINISHED_AFTER_HOURS * HOUR);
}

type Postable = Pick<Event, 'id' | 'seriesId' | 'startsAt'>;

/**
 * Only one event of a series is posted at a time: an event is posted once every earlier event
 * of its series has finished, cancelled ones included. Resolves, for each event that has to
 * wait, when it can be posted (when the event before it finishes). Events missing from the
 * map can be posted now: one-time events, and those whose earlier events have all finished.
 */
export async function postTimes(events: Postable[], now = new Date()): Promise<Map<string, Date>> {
  const waiting = new Map<string, Date>();
  const inSeries = events.filter((event) => event.seriesId);
  if (inSeries.length === 0) return waiting;
  // Only events that haven't finished can hold another back.
  const unfinished = await Event.findAll({
    attributes: ['seriesId', 'startsAt'],
    where: {
      seriesId: [...new Set(inSeries.map((event) => event.seriesId!))],
      startsAt: { [Op.gt]: new Date(now.getTime() - FINISHED_AFTER_HOURS * HOUR) },
    },
  });
  for (const event of inSeries) {
    const earlier = unfinished
      .filter((other) => other.seriesId === event.seriesId && other.startsAt < event.startsAt)
      .map((other) => other.startsAt.getTime());
    if (earlier.length > 0) {
      waiting.set(event.id, finishedAt({ startsAt: new Date(Math.max(...earlier)) }));
    }
  }
  return waiting;
}

/** When this event can be posted, or null when it can be now (see postTimes). */
export async function postAt(event: Postable, now = new Date()): Promise<Date | null> {
  return (await postTimes([event], now)).get(event.id) ?? null;
}

/**
 * The same rule as a condition on an `Event.findAll`: leaves out the events of a series that
 * still wait for an earlier one to finish.
 */
export function postableNow(now = new Date()) {
  const finishedBefore = new Date(now.getTime() - FINISHED_AFTER_HOURS * HOUR);
  // The query's alias for the events table is the model's name, which isn't "Event" in the
  // production bundle (esbuild renames the class), so it's read from the model.
  const table = `"${Event.name}"`;
  return literal(
    `NOT EXISTS (SELECT 1 FROM events AS earlier
       WHERE earlier.series_id = ${table}.series_id
         AND earlier.starts_at < ${table}.starts_at
         AND earlier.starts_at > ${Event.sequelize!.escape(finishedBefore.toISOString())})`,
  );
}
