import {
  createEventSchema,
  EVENT_ERROR_CODES,
  eventSlotIssues,
  SERIES_WEEKS_AHEAD,
  seriesChannelSchema,
  updateEventSchema,
  type CreateSeriesInput,
  type UpdateSeriesInput,
} from '@wgm/shared';
import { Op, Transaction } from 'sequelize';

import { Event, EventSeries, Guild, SignUp, type User } from '../db/models/index.js';
import { transaction } from '../db/transaction.js';
import type { Logger } from '../logger.js';
import { DomainError, DomainValidationError } from './errors.js';
import { applyEventChanges, checkStartsInFuture, eventColumns, parseInput } from './events.js';
import { mergeSignUpChanges, type SignUpChanges } from './sign-ups.js';
import { deadlineFor } from './tentative.js';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Creates a weekly series and its events for the next two weeks. `startsAt` is its first
 * event; the rest follow every 7 days at the same UTC time. Its channel, if any, must already
 * be checked (api/series.ts does, as it needs Discord).
 */
export async function createSeries(
  guild: Guild,
  input: CreateSeriesInput,
  createdBy: User,
  now = new Date(),
): Promise<EventSeries> {
  const { channelId: rawChannelId, ...event } = input;
  const details = parseInput(createEventSchema, event);
  const { channelId } = parseInput(seriesChannelSchema, { channelId: rawChannelId });
  if (details.preConfirmed?.length) {
    throw new DomainValidationError([
      { field: 'preConfirmed', code: EVENT_ERROR_CODES.preConfirmedNotAllowed },
    ]);
  }
  checkStartsInFuture(details.startsAt, now);
  return transaction(async () => {
    const series = await EventSeries.create({
      guildId: guild.id,
      type: details.type,
      ...eventColumns(details),
      channelId,
      createdByUserId: createdBy.id,
    });
    await extendSeries(series, now);
    return series;
  });
}

/**
 * Creates the series' missing events up to two weeks ahead. Safe to run at any time and in
 * parallel: a unique index keeps one event per week. Resolves the events it meant to create
 * (some may have been created in parallel), for scheduling their jobs.
 */
export async function extendSeries(series: EventSeries, now = new Date()): Promise<string[]> {
  if (series.stoppedAt) return [];
  const guild = (await Guild.findByPk(series.guildId))!;
  const horizon = now.getTime() + SERIES_WEEKS_AHEAD * WEEK;
  const last = await Event.max<Date | null, Event>('startsAt', { where: { seriesId: series.id } });
  let next = last ? last.getTime() + WEEK : series.startsAt.getTime();
  const events = [];
  for (; next <= horizon; next += WEEK) {
    if (next <= now.getTime()) continue;
    events.push({
      guildId: series.guildId,
      seriesId: series.id,
      type: series.type,
      name: series.name,
      description: series.description,
      startsAt: new Date(next),
      size: series.size,
      tankSlots: series.tankSlots,
      healerSlots: series.healerSlots,
      dpsSlots: series.dpsSlots,
      tentativeDeadlineHours: series.tentativeDeadlineHours,
      tentativeDeadlineAt: deadlineFor(
        { startsAt: new Date(next), tentativeDeadlineHours: series.tentativeDeadlineHours },
        guild,
      ),
      createdByUserId: series.createdByUserId,
    });
  }
  if (events.length === 0) return [];
  await Event.bulkCreate(events, { ignoreDuplicates: true });
  const created = await Event.findAll({
    attributes: ['id'],
    where: { seriesId: series.id, startsAt: events.map((event) => event.startsAt) },
  });
  return created.map((event) => event.id);
}

/** The worker's hourly job: keeps every running series two weeks ahead. */
export async function extendAllSeries(logger: Logger, now = new Date()): Promise<string[]> {
  const created: string[] = [];
  for (const series of await EventSeries.findAll({ where: { stoppedAt: null } })) {
    try {
      created.push(...(await extendSeries(series, now)));
    } catch (err) {
      logger.error({ err, seriesId: series.id }, 'Could not create the events of a series');
    }
  }
  return created;
}

/**
 * Edits a running series and every future event in it, including ones edited on their own.
 * `startsAt` is its next event: the future events move to it and every 7 days after. The type
 * can't change. Its channel, if it changes, must already be checked (as in createSeries).
 */
export async function updateSeries(
  guild: Guild,
  seriesId: string,
  input: UpdateSeriesInput,
  now = new Date(),
): Promise<{ series: EventSeries; changes: SignUpChanges }> {
  const { channelId: rawChannelId, ...event } = input;
  const details = parseInput(updateEventSchema, event);
  const { channelId } = parseInput(seriesChannelSchema, { channelId: rawChannelId });
  return transaction(async () => {
    const series = await runningSeries(guild, seriesId);
    const issues = eventSlotIssues(series.type, details);
    if (issues.length > 0) throw new DomainValidationError(issues);
    checkStartsInFuture(details.startsAt, now);

    const columns = eventColumns(details);
    const anchor = columns.startsAt.getTime();
    // Cancelled ones move too, so the weeks stay aligned, but keep their own details.
    const future = await Event.findAll({
      where: { seriesId: series.id, startsAt: { [Op.gt]: now } },
      order: [['startsAt', 'ASC']],
      lock: Transaction.LOCK.UPDATE,
    });
    const moves = future.map((event, index) => ({ event, startsAt: anchor + index * WEEK }));
    // Moving later, the last event moves first (and earlier, the first), so two events of the
    // series never share a time, which the unique index refuses.
    if (moves.length > 0 && moves[0]!.startsAt > moves[0]!.event.startsAt.getTime()) {
      moves.reverse();
    }
    const all = [];
    for (const { event, startsAt } of moves) {
      all.push(
        await applyEventChanges(
          event,
          event.cancelledAt
            ? { startsAt: new Date(startsAt) }
            : { ...columns, startsAt: new Date(startsAt) },
          guild,
        ),
      );
    }
    await series.update({ ...columns, channelId });
    await extendSeries(series, now);
    return { series, changes: mergeSignUpChanges(...all) };
  });
}

/**
 * Stops a series: no more events are created, and its future events are removed, except those
 * with sign-ups (other than Declined), which stay as events of their own. Its past events
 * stay. Resolves the Discord posts of the removed events, for the caller to delete.
 */
export async function stopSeries(
  guild: Guild,
  seriesId: string,
  stoppedBy: User,
  now = new Date(),
): Promise<{ series: EventSeries; removedPosts: { channelId: string; messageId: string }[] }> {
  return transaction(async () => {
    const series = await runningSeries(guild, seriesId);
    const future = await Event.findAll({
      where: { seriesId: series.id, startsAt: { [Op.gt]: now } },
      include: [
        {
          model: SignUp,
          as: 'signUps',
          attributes: ['id'],
          where: { status: { [Op.ne]: 'declined' } },
          required: false,
        },
      ],
    });
    const removed = future.filter((event) => event.signUps!.length === 0);
    await Event.destroy({ where: { id: removed.map((event) => event.id) } });
    return {
      series: await series.update({ stoppedAt: now, stoppedByUserId: stoppedBy.id }),
      removedPosts: removed
        .filter((event) => event.discordMessageId)
        .map((event) => ({
          channelId: event.discordChannelId!,
          messageId: event.discordMessageId!,
        })),
    };
  });
}

/** The series' events that haven't started, for updating their Discord posts. */
export async function futureEventIds(seriesId: string, now = new Date()): Promise<string[]> {
  const events = await Event.findAll({
    attributes: ['id'],
    where: { seriesId, startsAt: { [Op.gt]: now } },
  });
  return events.map((event) => event.id);
}

async function runningSeries(guild: Guild, seriesId: string): Promise<EventSeries> {
  const series = await EventSeries.findOne({
    where: { id: seriesId, guildId: guild.id },
    lock: Transaction.LOCK.UPDATE,
  });
  if (!series) throw new DomainError({ code: 'NOT_FOUND' });
  if (series.stoppedAt) throw new DomainError({ code: 'SERIES_STOPPED' });
  return series;
}
