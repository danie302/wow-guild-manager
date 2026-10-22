import {
  addParticipantSchema,
  eventListQuerySchema,
  saveAttendanceSchema,
  type AttendanceResponse,
  replaceParticipantSchema,
  uuidSchema,
  type CreateEventInput,
  type EventDiscordPostResponse,
  type EventResponse,
  type GuildAccess,
  type SignUpResponse,
  type UpdateEventInput,
} from '@wgm/shared';
import express from 'express';
import { Op, type WhereOptions } from 'sequelize';

import { Event, EventSeries, SignUp, User, type Guild } from '../db/models/index.js';
import {
  attendanceHistory,
  attendanceList,
  attendanceOpen,
  saveAttendance,
} from '../domain/attendance.js';
import { DomainError } from '../domain/errors.js';
import { cancelEvent, createEvent, updateEvent } from '../domain/events.js';
import { can } from '../domain/permissions.js';
import {
  addParticipant,
  eventSignUps,
  removeParticipant,
  replaceTentative,
} from '../domain/sign-ups.js';
import { deadlineHours } from '../domain/tentative.js';
import { eventPostButtonLabels, eventPostEmbed, NO_EMOJIS } from '../domain/event-post.js';
import { enqueueEventPosts } from '../jobs/event-posts.js';
import { notifySignUpChanges } from '../jobs/sign-up-notices.js';
import { scheduleEventJobs } from '../jobs/event-jobs.js';
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
    const { guild, access } = currentGuild(res);
    const query = parseBody(eventListQuerySchema, req.query, res);
    if (!query) return;
    const now = new Date();
    // Members only see events that haven't started.
    if (access === 'member' && 'scope' in query && query.scope === 'past') {
      res.json([]);
      return;
    }
    let where: WhereOptions<Event>;
    let order: 'ASC' | 'DESC' = 'ASC';
    if ('scope' in query) {
      where = { startsAt: query.scope === 'upcoming' ? { [Op.gt]: now } : { [Op.lte]: now } };
      if (query.scope === 'past') order = 'DESC';
    } else {
      const from = new Date(query.from);
      where = {
        startsAt: {
          [Op.gte]: access === 'member' && from < now ? now : from,
          [Op.lt]: new Date(query.to),
        },
      };
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
    res.json(events.map((event) => toEventResponse(event, guild, access)));
  });

  router.post(base, requireUser, requireGuildPermission('manageEvents'), async (req, res) => {
    const { guild, access } = currentGuild(res);
    // createEvent checks the event (and answers with its issues).
    const input = req.body as CreateEventInput;
    // Only the Guild Master pre-confirms participants; createEvent checks the rest.
    if (input?.preConfirmed?.length && !can(access, 'preConfirmParticipants')) {
      throw new DomainError({ code: 'FORBIDDEN' });
    }
    const event = await createEvent(guild, input, currentUser(res));
    if (jobs) {
      await enqueueEventPosts(jobs, [event.id]);
      await scheduleEventJobs(jobs, [event.id]);
      const preConfirmed = await SignUp.findAll({
        attributes: ['id'],
        where: { eventId: event.id },
      });
      await jobs.enqueueMany(
        'pre-confirmed',
        preConfirmed.map((signUp) => ({ signUpId: signUp.id })),
      );
    }
    res.status(201).json(await eventResponse(event.id, guild));
  });

  router.get(
    `${base}/:eventId`,
    requireUser,
    requireGuildPermission('viewEvents'),
    async (req, res) => {
      const { guild, access } = currentGuild(res);
      const event = await Event.findOne({
        where: { id: eventId(req.params.eventId), guildId: guild.id },
        include: people,
      });
      if (!event || !visibleTo(access, event)) throw new DomainError({ code: 'NOT_FOUND' });
      res.json(toEventResponse(event, guild, access));
    },
  );

  // The event's sign-ups, in sign-up order: for the event form's warning, and the sign-ups tab.
  router.get(
    `${base}/:eventId/sign-ups`,
    requireUser,
    requireGuildPermission('viewEvents'),
    async (req, res) => {
      const { guild, access } = currentGuild(res);
      const event = await Event.findOne({
        attributes: ['id', 'startsAt'],
        where: { id: eventId(req.params.eventId), guildId: guild.id },
      });
      if (!event || !visibleTo(access, event)) throw new DomainError({ code: 'NOT_FOUND' });
      res.json((await eventSignUps(event.id)).map(toSignUpResponse));
    },
  );

  // Signs a member up (or changes their sign-up), with the same rules as in Discord.
  router.post(
    `${base}/:eventId/sign-ups`,
    requireUser,
    requireGuildPermission('manageParticipants'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const body = parseBody(addParticipantSchema, req.body, res);
      if (!body) return;
      const id = eventId(req.params.eventId);
      const changes = await addParticipant(guild, id, body, currentUser(res));
      if (jobs) {
        await enqueueEventPosts(jobs, [id]);
        await notifySignUpChanges(jobs, changes);
        // Past the reminder time, a new Tentative participant gets the reminder right away.
        if (body.status === 'tentative') await jobs.enqueue('tentative-reminder', { eventId: id });
      }
      res.status(201).json((await eventSignUps(id)).map(toSignUpResponse));
    },
  );

  // Removes a participant (slot or waitlist); their spot goes to the waitlist.
  router.delete(
    `${base}/:eventId/sign-ups/:signUpId`,
    requireUser,
    requireGuildPermission('manageParticipants'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const id = eventId(req.params.eventId);
      const changes = await removeParticipant(
        guild,
        id,
        eventId(req.params.signUpId),
        currentUser(res),
      );
      if (jobs) {
        await enqueueEventPosts(jobs, [id]);
        await notifySignUpChanges(jobs, changes);
      }
      res.json((await eventSignUps(id)).map(toSignUpResponse));
    },
  );

  // Gives a Tentative participant's slot to a waitlisted character of the same role.
  router.post(
    `${base}/:eventId/sign-ups/:signUpId/replace`,
    requireUser,
    requireGuildPermission('manageParticipants'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const body = parseBody(replaceParticipantSchema, req.body, res);
      if (!body) return;
      const id = eventId(req.params.eventId);
      const changes = await replaceTentative(
        guild,
        id,
        eventId(req.params.signUpId),
        body.replacementId,
      );
      if (jobs) {
        await enqueueEventPosts(jobs, [id]);
        await notifySignUpChanges(jobs, changes);
      }
      res.json((await eventSignUps(id)).map(toSignUpResponse));
    },
  );

  // The attendance list: saved records, or a draft pre-filled from the sign-ups.
  router.get(
    `${base}/:eventId/attendance`,
    requireUser,
    requireGuildPermission('recordAttendance'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const event = await Event.findOne({
        where: { id: eventId(req.params.eventId), guildId: guild.id },
        include: [{ model: User, as: 'attendanceRecordedBy', attributes: ['name'] }],
      });
      if (!event) throw new DomainError({ code: 'NOT_FOUND' });
      res.json(await toAttendanceResponse(event));
    },
  );

  // Saves the whole list; after the first save, each change is recorded as a correction.
  router.put(
    `${base}/:eventId/attendance`,
    requireUser,
    requireGuildPermission('recordAttendance'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const input = parseBody(saveAttendanceSchema, req.body, res);
      if (!input) return;
      const id = eventId(req.params.eventId);
      await saveAttendance(guild, id, input, currentUser(res));
      const event = await Event.findByPk(id, {
        include: [{ model: User, as: 'attendanceRecordedBy', attributes: ['name'] }],
      });
      res.json(await toAttendanceResponse(event!));
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
        include: people,
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
        embed: eventPostEmbed(event, guild.discordLocale, {
          signUps: await eventSignUps(event.id),
          leader: event.createdBy?.name ?? null,
          emojis: discord?.emojis ? await discord.emojis() : NO_EMOJIS,
        }),
        buttons: event.cancelledAt ? [] : eventPostButtonLabels(guild.discordLocale),
      } satisfies EventDiscordPostResponse);
    },
  );

  router.put(
    `${base}/:eventId`,
    requireUser,
    requireGuildPermission('manageEvents'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const { event, changes } = await updateEvent(
        guild,
        eventId(req.params.eventId),
        req.body as UpdateEventInput,
      );
      if (jobs) {
        await enqueueEventPosts(jobs, [event.id]);
        await scheduleEventJobs(jobs, [event.id]);
        await notifySignUpChanges(jobs, changes);
      }
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
      if (jobs) {
        await enqueueEventPosts(jobs, [event.id]);
        // Its reminder and deadline jobs go.
        await scheduleEventJobs(jobs, [event.id]);
      }
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

async function toAttendanceResponse(event: Event): Promise<AttendanceResponse> {
  const open = attendanceOpen(event);
  return {
    open,
    recorded: event.attendanceRecordedAt
      ? {
          at: event.attendanceRecordedAt.toISOString(),
          by: event.attendanceRecordedBy?.name ?? null,
        }
      : null,
    records: open
      ? (await attendanceList(event)).map((row) => ({
          memberId: row.member.id,
          discordName: row.member.discordName,
          character: {
            id: row.character.id,
            name: row.character.name,
            class: row.character.characterClass,
            race: row.character.race,
          },
          role: row.role,
          signedUp: row.signedUp,
          status: row.status,
        }))
      : [],
    history: (await attendanceHistory(event.id)).map((change) => ({
      id: change.id,
      memberId: change.attendance!.memberId,
      character: {
        name: change.attendance!.character!.name,
        class: change.attendance!.character!.characterClass,
      },
      from: change.fromStatus,
      to: change.toStatus,
      by: change.changedBy?.name ?? null,
      at: change.createdAt.toISOString(),
    })),
  };
}

export function toSignUpResponse(signUp: SignUp): SignUpResponse {
  return {
    id: signUp.id,
    memberId: signUp.memberId,
    character: {
      id: signUp.characterId,
      name: signUp.character!.name,
      class: signUp.character!.characterClass,
      race: signUp.character!.race,
    },
    role: signUp.role,
    status: signUp.status,
    placement: signUp.placement,
    signedUpAt: signUp.signedUpAt.toISOString(),
  };
}

export function eventId(id: unknown): string {
  if (!uuidSchema.safeParse(id).success) throw new DomainError({ code: 'NOT_FOUND' });
  return id as string;
}

async function eventResponse(id: string, guild: Guild): Promise<EventResponse> {
  return toEventResponse((await Event.findByPk(id, { include: people }))!, guild);
}

/** Members can't open events that have started. */
function visibleTo(access: GuildAccess, event: Pick<Event, 'startsAt'>): boolean {
  return access !== 'member' || event.startsAt > new Date();
}

function toEventResponse(
  event: Event,
  guild: Guild,
  access: GuildAccess = 'officer',
): EventResponse {
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
    tentativeDeadline: {
      at: event.tentativeDeadlineAt.toISOString(),
      hours: deadlineHours(event),
      own: event.tentativeDeadlineHours !== null,
    },
    discordPost: {
      url: event.discordMessageId
        ? `https://discord.com/channels/${guild.discordServerId}/${event.discordChannelId}/${event.discordMessageId}`
        : null,
      // Only the Guild Master and Officers can fix it, so only they hear about it.
      error: access === 'member' ? null : event.discordPostError,
    },
  };
}
