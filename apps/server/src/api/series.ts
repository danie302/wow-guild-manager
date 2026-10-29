import {
  seriesChannelSchema,
  type CreateSeriesInput,
  type DiscordChannelsResponse,
  type SeriesResponse,
  type SeriesSignUpsResponse,
  type UpdateSeriesInput,
} from '@wgm/shared';
import express from 'express';
import { Op } from 'sequelize';

import { Event, EventSeries, User, type Guild } from '../db/models/index.js';
import { DomainError } from '../domain/errors.js';
import { checkPostableChannel } from '../domain/guild-settings.js';
import { postableChannels } from '../domain/guilds.js';
import type { Logger } from '../logger.js';
import { createSeries, futureEventIds, stopSeries, updateSeries } from '../domain/series.js';
import { enqueueEventPosts } from '../jobs/event-posts.js';
import { notifySignUpChanges } from '../jobs/sign-up-notices.js';
import { scheduleEventJobs } from '../jobs/event-jobs.js';
import type { JobEnqueuer } from '../jobs/index.js';
import { eventSignUps } from '../domain/sign-ups.js';
import { requireDiscord, type DiscordAccess } from './discord.js';
import { eventId as seriesId, toSignUpResponse } from './events.js';
import { currentGuild, requireGuildPermission } from './guild-access.js';
import { describeChannels } from './guilds.js';
import { currentUser, requireUser } from './me.js';

/**
 * Weekly series of events, such as "MC every Tuesday". Changes ask the worker (`jobs`) to
 * update the events' Discord posts; without it (some tests), the posts don't change. A
 * series' own channel is checked with `discord`, so it can't be set without it.
 */
export function seriesRouter(jobs: JobEnqueuer | null, discord: DiscordAccess | null) {
  const router = express.Router();
  const base = '/guilds/:guildId/series';

  // The channels a series can be posted in: those of the guild's server where the bot can post.
  router.get(
    '/guilds/:guildId/channels',
    requireUser,
    requireGuildPermission('manageEvents'),
    requireDiscord(discord),
    async (_req, res) => {
      const { guild } = currentGuild(res);
      const { directory, botUserId } = discord!;
      const server = await directory.server(guild.discordServerId);
      const options = server ? await postableChannels(server, directory, botUserId) : [];
      res.json({
        channels: options.map(({ channel, category }) => ({
          id: channel.id,
          name: channel.name,
          category: category?.name ?? null,
        })),
      } satisfies DiscordChannelsResponse);
    },
  );

  // The running series, soonest next event first.
  router.get(base, requireUser, requireGuildPermission('viewSeries'), async (req, res) => {
    const { guild } = currentGuild(res);
    const all = await EventSeries.findAll({
      where: { guildId: guild.id, stoppedAt: null },
      include: people,
    });
    const channels = await describeChannels(
      guild,
      all.map((series) => series.channelId),
      discord,
      req.log,
    );
    const responses = await Promise.all(
      all.map((series, index) => toSeriesResponse(series, channels[index]!)),
    );
    responses.sort((a, b) => (a.nextEventAt ?? '~').localeCompare(b.nextEventAt ?? '~'));
    res.json(responses);
  });

  // Creates the series and its first two weeks of events.
  router.post(base, requireUser, requireGuildPermission('manageEvents'), async (req, res) => {
    const { guild } = currentGuild(res);
    const input = req.body as CreateSeriesInput;
    await checkSeriesChannel(guild, input, null, discord);
    const series = await createSeries(guild, input, currentUser(res));
    if (jobs) {
      const ids = await futureEventIds(series.id);
      await enqueueEventPosts(jobs, ids);
      await scheduleEventJobs(jobs, ids);
    }
    res.status(201).json(await seriesResponse(guild, series.id, discord, req.log));
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
      const [channel] = await describeChannels(guild, [series.channelId], discord, req.log);
      res.json(await toSeriesResponse(series, channel!));
    },
  );

  router.put(
    `${base}/:seriesId`,
    requireUser,
    requireGuildPermission('manageEvents'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const input = req.body as UpdateSeriesInput;
      const current = await EventSeries.findOne({
        attributes: ['channelId'],
        where: { id: seriesId(req.params.seriesId), guildId: guild.id },
      });
      if (current) await checkSeriesChannel(guild, input, current.channelId, discord);
      const { series, changes } = await updateSeries(guild, seriesId(req.params.seriesId), input);
      if (jobs) {
        const ids = await futureEventIds(series.id);
        await enqueueEventPosts(jobs, ids);
        await scheduleEventJobs(jobs, ids);
        await notifySignUpChanges(jobs, changes);
      }
      res.json(await seriesResponse(guild, series.id, discord, req.log));
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
      res.json(await seriesResponse(guild, series.id, discord, req.log));
    },
  );

  return router;
}

const people = [
  { model: User, as: 'createdBy', attributes: ['name'] },
  { model: User, as: 'stoppedBy', attributes: ['name'] },
];

/**
 * A new or changed series channel must be one the bot can post in. Checked here rather than in
 * domain/series.ts, as it reads Discord; an unchanged one isn't checked again.
 */
async function checkSeriesChannel(
  guild: Guild,
  input: { channelId?: unknown },
  current: string | null,
  discord: DiscordAccess | null,
): Promise<void> {
  const parsed = seriesChannelSchema.safeParse({ channelId: input.channelId });
  // An invalid value is reported by the domain's validation, with the event fields.
  if (!parsed.success || parsed.data.channelId === null || parsed.data.channelId === current) {
    return;
  }
  if (!discord) throw new DomainError({ code: 'DISCORD_NOT_CONFIGURED' });
  await checkPostableChannel(guild.discordServerId, parsed.data.channelId, discord, 'channelId');
}

async function seriesResponse(
  guild: Guild,
  id: string,
  discord: DiscordAccess | null,
  log: Logger,
): Promise<SeriesResponse> {
  const series = (await EventSeries.findByPk(id, { include: people }))!;
  const [channel] = await describeChannels(guild, [series.channelId], discord, log);
  return toSeriesResponse(series, channel!);
}

async function toSeriesResponse(
  series: EventSeries,
  channel: SeriesResponse['channel'],
): Promise<SeriesResponse> {
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
    channel,
    createdBy: series.createdBy?.name ?? null,
    stopped: series.stoppedAt
      ? { at: series.stoppedAt.toISOString(), by: series.stoppedBy?.name ?? null }
      : null,
  };
}
