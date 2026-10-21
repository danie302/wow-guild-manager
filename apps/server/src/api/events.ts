import {
  eventListQuerySchema,
  uuidSchema,
  type CreateEventInput,
  type EventResponse,
  type UpdateEventInput,
} from '@wgm/shared';
import express from 'express';
import { Op, type WhereOptions } from 'sequelize';

import { Event, EventSeries, User } from '../db/models/index.js';
import { DomainError } from '../domain/errors.js';
import { cancelEvent, createEvent, updateEvent } from '../domain/events.js';
import { parseBody } from './errors.js';
import { currentGuild, requireGuildPermission } from './guild-access.js';
import { currentUser, requireUser } from './me.js';

/** How many past events the list shows. */
const PAST_EVENTS_LIMIT = 100;

/** The guild's events. Times are UTC; the web app shows them in each user's time zone. */
export function eventsRouter() {
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
    res.json(events.map(toEventResponse));
  });

  router.post(base, requireUser, requireGuildPermission('manageEvents'), async (req, res) => {
    const { guild } = currentGuild(res);
    // createEvent checks the event (and answers with its issues).
    const event = await createEvent(guild, req.body as CreateEventInput, currentUser(res));
    res.status(201).json(await eventResponse(event.id));
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
      res.json(toEventResponse(event));
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
      res.json(await eventResponse(event.id));
    },
  );

  router.post(
    `${base}/:eventId/cancel`,
    requireUser,
    requireGuildPermission('manageEvents'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const event = await cancelEvent(guild, eventId(req.params.eventId), currentUser(res));
      res.json(await eventResponse(event.id));
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

async function eventResponse(id: string): Promise<EventResponse> {
  return toEventResponse((await Event.findByPk(id, { include: people }))!);
}

function toEventResponse(event: Event): EventResponse {
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
  };
}
