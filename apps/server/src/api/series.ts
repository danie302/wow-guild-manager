import type {
  CreateEventInput,
  SeriesResponse,
  SeriesSignUpsResponse,
  UpdateEventInput,
} from '@wgm/shared';
import express from 'express';
import { Op } from 'sequelize';

import { Event, EventSeries, User } from '../db/models/index.js';
import { DomainError } from '../domain/errors.js';
import { createSeries, futureEventIds, stopSeries, updateSeries } from '../domain/series.js';
import { enqueueEventPosts } from '../jobs/event-posts.js';
import { notifySignUpChanges } from '../jobs/sign-up-notices.js';
import { scheduleEventJobs } from '../jobs/event-jobs.js';
import type { JobEnqueuer } from '../jobs/index.js';
import { eventSignUps } from '../domain/sign-ups.js';
import { eventId as seriesId, toSignUpResponse } from './events.js';
import { currentGuild, requireGuildPermission } from './guild-access.js';
import { currentUser, requireUser } from './me.js';

/**
 * Weekly series of events, such as "MC every Tuesday". Changes ask the worker (`jobs`) to
 * update the events' Discord posts; without it (some tests), the posts don't change.
 */
export function seriesRouter(jobs: JobEnqueuer | null) {
  const router = express.Router();
  const base = '/guilds/:guildId/series';

  // The running series, soonest next event first.
  router.get(base, requireUser, requireGuildPermission('viewSeries'), async (_req, res) => {
    const { guild } = currentGuild(res);
    const all = await EventSeries.findAll({
      where: { guildId: guild.id, stoppedAt: null },
      include: people,
    });
    const responses = await Promise.all(all.map(toSeriesResponse));
    responses.sort((a, b) => (a.nextEventAt ?? '~').localeCompare(b.nextEventAt ?? '~'));
    res.json(responses);
  });

  // Creates the series and its first two weeks of events.
  router.post(base, requireUser, requireGuildPermission('manageEvents'), async (req, res) => {
    const { guild } = currentGuild(res);
    const series = await createSeries(guild, req.body as CreateEventInput, currentUser(res));
    if (jobs) {
      const ids = await futureEventIds(series.id);
      await enqueueEventPosts(jobs, ids);
      await scheduleEventJobs(jobs, ids);
    }
    res.status(201).json(await seriesResponse(series.id));
  });

  router.get(
    `${base}/:seriesId`,
    requireUser,
    requireGuildPermission('viewSeries'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const series = await EventSeries.findOne({
        where: { id: seriesId(req.params.seriesId), guildId: guild.id },
        include: people,
      });
      if (!series) throw new DomainError({ code: 'NOT_FOUND' });
      res.json(await toSeriesResponse(series));
    },
  );

  router.put(
    `${base}/:seriesId`,
    requireUser,
    requireGuildPermission('manageEvents'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const { series, changes } = await updateSeries(
        guild,
        seriesId(req.params.seriesId),
        req.body as UpdateEventInput,
      );
      if (jobs) {
        const ids = await futureEventIds(series.id);
        await enqueueEventPosts(jobs, ids);
        await scheduleEventJobs(jobs, ids);
        await notifySignUpChanges(jobs, changes);
      }
      res.json(await seriesResponse(series.id));
    },
  );

  // The sign-ups of each future event, for the series form's warning about fewer slots.
  router.get(
    `${base}/:seriesId/sign-ups`,
    requireUser,
    requireGuildPermission('viewSeries'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const series = await EventSeries.findOne({
        attributes: ['id'],
        where: { id: seriesId(req.params.seriesId), guildId: guild.id },
      });
      if (!series) throw new DomainError({ code: 'NOT_FOUND' });
      const events = await Event.findAll({
        attributes: ['id', 'startsAt'],
        where: { seriesId: series.id, startsAt: { [Op.gt]: new Date() }, cancelledAt: null },
        order: [['startsAt', 'ASC']],
      });
      res.json({
        events: await Promise.all(
          events.map(async (event) => ({
            id: event.id,
            startsAt: event.startsAt.toISOString(),
            signUps: (await eventSignUps(event.id)).map(toSignUpResponse),
          })),
        ),
      } satisfies SeriesSignUpsResponse);
    },
  );

  router.post(
    `${base}/:seriesId/stop`,
    requireUser,
    requireGuildPermission('manageEvents'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const { series, removedPosts } = await stopSeries(
        guild,
        seriesId(req.params.seriesId),
        currentUser(res),
      );
      for (const post of removedPosts) await jobs?.enqueue('event-post-delete', post);
      res.json(await seriesResponse(series.id));
    },
  );

  return router;
}

const people = [
  { model: User, as: 'createdBy', attributes: ['name'] },
  { model: User, as: 'stoppedBy', attributes: ['name'] },
];

async function seriesResponse(id: string): Promise<SeriesResponse> {
  return toSeriesResponse((await EventSeries.findByPk(id, { include: people }))!);
}

async function toSeriesResponse(series: EventSeries): Promise<SeriesResponse> {
  const next = await Event.findOne({
    where: { seriesId: series.id, cancelledAt: null, startsAt: { [Op.gt]: new Date() } },
    order: [['startsAt', 'ASC']],
    attributes: ['id', 'startsAt'],
  });
  return {
    id: series.id,
    type: series.type,
    name: series.name,
    description: series.description,
    startsAt: series.startsAt.toISOString(),
    size: series.size,
    slots: { tank: series.tankSlots, healer: series.healerSlots, dps: series.dpsSlots },
    // Before its first event is created (two weeks ahead), the next one is its start.
    nextEventAt:
      next?.startsAt.toISOString() ??
      (!series.stoppedAt && series.startsAt > new Date() ? series.startsAt.toISOString() : null),
    nextEventId: next?.id ?? null,
    tentativeDeadlineHours: series.tentativeDeadlineHours,
    createdBy: series.createdBy?.name ?? null,
    stopped: series.stoppedAt
      ? { at: series.stoppedAt.toISOString(), by: series.stoppedBy?.name ?? null }
      : null,
  };
}
