import type { CreateEventInput, SeriesResponse, UpdateEventInput } from '@wgm/shared';
import express from 'express';
import { Op } from 'sequelize';

import { Event, EventSeries, User } from '../db/models/index.js';
import { DomainError } from '../domain/errors.js';
import { createSeries, stopSeries, updateSeries } from '../domain/series.js';
import { eventId as seriesId } from './events.js';
import { currentGuild, requireGuildPermission } from './guild-access.js';
import { currentUser, requireUser } from './me.js';

/** Weekly series of events, such as "MC every Tuesday". */
export function seriesRouter() {
  const router = express.Router();
  const base = '/guilds/:guildId/series';

  // The running series, soonest next event first.
  router.get(base, requireUser, requireGuildPermission('viewEvents'), async (_req, res) => {
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
    res.status(201).json(await seriesResponse(series.id));
  });

  router.get(
    `${base}/:seriesId`,
    requireUser,
    requireGuildPermission('viewEvents'),
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
      const series = await updateSeries(
        guild,
        seriesId(req.params.seriesId),
        req.body as UpdateEventInput,
      );
      res.json(await seriesResponse(series.id));
    },
  );

  router.post(
    `${base}/:seriesId/stop`,
    requireUser,
    requireGuildPermission('manageEvents'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const series = await stopSeries(guild, seriesId(req.params.seriesId), currentUser(res));
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
    attributes: ['startsAt'],
  });
  return {
    id: series.id,
    type: series.type,
    name: series.name,
    description: series.description,
    startsAt: series.startsAt.toISOString(),
    size: series.size,
    slots: { tank: series.tankSlots, healer: series.healerSlots, dps: series.dpsSlots },
    nextEventAt: next?.startsAt.toISOString() ?? null,
    createdBy: series.createdBy?.name ?? null,
    stopped: series.stoppedAt
      ? { at: series.stoppedAt.toISOString(), by: series.stoppedBy?.name ?? null }
      : null,
  };
}
