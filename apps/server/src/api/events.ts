import {
  eventListQuerySchema,
  uuidSchema,
  type CreateEventInput,
  type EventDiscordPostResponse,
  type EventResponse,
  type UpdateEventInput,
} from '@wgm/shared';
import express from 'express';
import { Op, type WhereOptions } from 'sequelize';

import { Event, EventSeries, User, type Guild } from '../db/models/index.js';
import { DomainError } from '../domain/errors.js';
import { eventPostEmbed } from '../domain/event-post.js';
import { cancelEvent, createEvent, updateEvent } from '../domain/events.js';
import { enqueueEventPosts } from '../jobs/event-posts.js';
import type { JobEnqueuer } from '../jobs/index.js';
import type { DiscordAccess } from './discord.js';
import { parseBody } from './errors.js';
import { eventsChannelName } from './guilds.js';
import { currentGuild, requireGuildPermission } from './guild-access.js';
import { currentUser, requireUser } from './me.js';

/** How many past events the list shows. */
const PAST_EVENTS_LIMIT = 100;

/**
 * The guild's events. Times are UTC; the web app shows them in each user's time zone. Changes
 * ask the worker (`jobs`) to update the event's Discord post; without it (some tests), the
 * post doesn't change.
 */
export function eventsRouter(jobs: JobEnqueuer | null, discord: DiscordAccess | null) {
  const router = express.Router();
  const base = '/guilds/:guildId/events';

  router.get(base, requireUser, requireGuildPermission('viewEvents'), async (req, res) => {
    const { guild } = currentGuild(res);
    const query = parseBody(eventListQuerySchema, req.query, res);
    if (!query) return;
    const now = new Date();
    let where: WhereOptions<Event>;
    let order: 'ASC' | 'DESC' = 'ASC';
    if ('scope' in query) {
      where = { startsAt: query.scope === 'upcoming' ? { [Op.gt]: now } : { [Op.lte]: now } };
      if (query.scope === 'past') order = 'DESC';
    } else {
      where = { startsAt: { [Op.gte]: new Date(query.from), [Op.lt]: new Date(query.to) } };
    }
    const events = await Event.findAll({
      where: { guildId: guild.id, ...where },
      include: people,
      order: [
        ['startsAt', order],
        ['id', 'ASC'],
      ],
      ...('scope' in query && query.scope === 'past' && { limit: PAST_EVENTS_LIMIT }),
    });
    res.json(events.map((event) => toEventResponse(event, guild)));
  });

  router.post(base, requireUser, requireGuildPermission('manageEvents'), async (req, res) => {
    const { guild } = currentGuild(res);
    // createEvent checks the event (and answers with its issues).
    const event = await createEvent(guild, req.body as CreateEventInput, currentUser(res));
    if (jobs) await enqueueEventPosts(jobs, [event.id]);
    res.status(201).json(await eventResponse(event.id, guild));
  });

  router.get(
    `${base}/:eventId`,
    requireUser,
    requireGuildPermission('viewEvents'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const event = await Event.findOne({
        where: { id: eventId(req.params.eventId), guildId: guild.id },
        include: people,
      });
      if (!event) throw new DomainError({ code: 'NOT_FOUND' });
      res.json(toEventResponse(event, guild));
    },
  );

  // The message the bot posts for the event, for the event page's preview.
  router.get(
    `${base}/:eventId/discord-post`,
    requireUser,
    requireGuildPermission('manageEvents'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const event = await Event.findOne({
        where: { id: eventId(req.params.eventId), guildId: guild.id },
      });
      if (!event) throw new DomainError({ code: 'NOT_FOUND' });
      res.json({
        channel: guild.eventsChannelId
          ? {
              id: guild.eventsChannelId,
              name: await eventsChannelName(guild, discord, req.log),
            }
          : null,
        locale: guild.discordLocale,
        embed: eventPostEmbed(event, guild.discordLocale),
      } satisfies EventDiscordPostResponse);
    },
  );

  router.put(
    `${base}/:eventId`,
    requireUser,
    requireGuildPermission('manageEvents'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const event = await updateEvent(
        guild,
        eventId(req.params.eventId),
        req.body as UpdateEventInput,
      );
      if (jobs) await enqueueEventPosts(jobs, [event.id]);
      res.json(await eventResponse(event.id, guild));
    },
  );

  router.post(
    `${base}/:eventId/cancel`,
    requireUser,
    requireGuildPermission('manageEvents'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const event = await cancelEvent(guild, eventId(req.params.eventId), currentUser(res));
      if (jobs) await enqueueEventPosts(jobs, [event.id]);
      res.json(await eventResponse(event.id, guild));
    },
  );

  return router;
}

const people = [
  { model: User, as: 'createdBy', attributes: ['name'] },
  { model: User, as: 'cancelledBy', attributes: ['name'] },
  { model: EventSeries, as: 'series', attributes: ['id', 'name'] },
];

export function eventId(id: unknown): string {
  if (!uuidSchema.safeParse(id).success) throw new DomainError({ code: 'NOT_FOUND' });
  return id as string;
}

async function eventResponse(id: string, guild: Guild): Promise<EventResponse> {
  return toEventResponse((await Event.findByPk(id, { include: people }))!, guild);
}

function toEventResponse(event: Event, guild: Guild): EventResponse {
  return {
    id: event.id,
    type: event.type,
    name: event.name,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    size: event.size,
    slots: { tank: event.tankSlots, healer: event.healerSlots, dps: event.dpsSlots },
    createdBy: event.createdBy?.name ?? null,
    cancelled: event.cancelledAt
      ? { at: event.cancelledAt.toISOString(), by: event.cancelledBy?.name ?? null }
      : null,
    series: event.series ? { id: event.series.id, name: event.series.name } : null,
    discordPost: {
      url: event.discordMessageId
        ? `https://discord.com/channels/${guild.discordServerId}/${event.discordChannelId}/${event.discordMessageId}`
        : null,
      error: event.discordPostError,
    },
  };
}
