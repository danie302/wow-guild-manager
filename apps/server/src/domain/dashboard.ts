import { COMBAT_ROLES, type CombatRole, type DashboardResponse } from '@wgm/shared';
import { Op } from 'sequelize';

import { Character, Event, Member, Registration, SignUp, type Guild } from '../db/models/index.js';
import { rankResolver } from './ranks.js';

const HOUR = 60 * 60 * 1000;
/** How many upcoming events the dashboard shows. */
const UPCOMING = 4;
/** Events this close are checked for missing roles. */
const MISSING_ROLES_WITHIN = 8 * 24 * HOUR;
/** Tentative participants are listed once their deadline is this close. */
const TENTATIVE_WITHIN = 48 * HOUR;

/**
 * The Guild Master's and Officers' home page: the next events and how full they are, events
 * soon that miss players, Tentative participants close to their deadline, pending requests to
 * join, and members who left the Discord server.
 */
export async function dashboard(guild: Guild, now = new Date()): Promise<DashboardResponse> {
  const events = await Event.findAll({
    where: { guildId: guild.id, startsAt: { [Op.gt]: now } },
    order: [
      ['startsAt', 'ASC'],
      ['id', 'ASC'],
    ],
    limit: 50,
  });
  const signUps = await SignUp.findAll({
    where: { eventId: events.map((event) => event.id), placement: { [Op.ne]: null } },
    include: [{ model: Character, as: 'character', attributes: ['name', 'characterClass'] }],
  });
  const slotsOf = (event: Event): Record<CombatRole, number> => ({
    tank: event.tankSlots,
    healer: event.healerSlots,
    dps: event.dpsSlots,
  });
  const filledOf = (event: Event) =>
    Object.fromEntries(
      COMBAT_ROLES.map((role) => [
        role,
        signUps.filter((s) => s.eventId === event.id && s.role === role && s.placement === 'slot')
          .length,
      ]),
    ) as Record<CombatRole, number>;
  const live = events.filter((event) => !event.cancelledAt);

  const missingRoles = live
    .filter((event) => event.startsAt.getTime() - now.getTime() < MISSING_ROLES_WITHIN)
    .map((event) => {
      const slots = slotsOf(event);
      const filled = filledOf(event);
      const missing = Object.fromEntries(
        COMBAT_ROLES.map((role) => [role, Math.max(0, slots[role] - filled[role])]),
      ) as Record<CombatRole, number>;
      return { event, missing };
    })
    .filter(({ missing }) => COMBAT_ROLES.some((role) => missing[role] > 0));

  const closing = live.filter((event) => {
    const left = event.tentativeDeadlineAt.getTime() - now.getTime();
    return left > 0 && left < TENTATIVE_WITHIN;
  });
  const tentative = closing.flatMap((event) =>
    signUps
      .filter((s) => s.eventId === event.id && s.status === 'tentative' && s.placement === 'slot')
      .map((signUp) => ({ event, signUp })),
  );

  const registrations = await Registration.findAll({
    where: { guildId: guild.id, status: 'pending' },
    order: [['createdAt', 'ASC']],
  });
  const left = await Member.findAll({
    where: { guildId: guild.id, removedAt: null, leftDiscordAt: { [Op.ne]: null } },
    include: [{ model: Character, as: 'characters', where: { removedAt: null }, required: false }],
    order: [['leftDiscordAt', 'DESC']],
  });
  const rankOf = await rankResolver(guild);

  return {
    upcoming: events.slice(0, UPCOMING).map((event) => ({
      id: event.id,
      type: event.type,
      name: event.name,
      startsAt: event.startsAt.toISOString(),
      size: event.size,
      cancelled: event.cancelledAt !== null,
      slots: slotsOf(event),
      filled: filledOf(event),
    })),
    missingRoles: missingRoles.map(({ event, missing }) => ({
      id: event.id,
      name: event.name,
      startsAt: event.startsAt.toISOString(),
      size: event.size,
      missing,
    })),
    tentative: tentative.map(({ event, signUp }) => ({
      signUpId: signUp.id,
      eventId: event.id,
      eventName: event.name,
      startsAt: event.startsAt.toISOString(),
      deadlineAt: event.tentativeDeadlineAt.toISOString(),
      character: { name: signUp.character!.name, class: signUp.character!.characterClass },
      role: signUp.role!,
    })),
    registrations: registrations.map((registration) => ({
      id: registration.id,
      discordName: registration.discordName,
      requestedAt: registration.createdAt.toISOString(),
    })),
    leftDiscord: left.map((member) => {
      const main =
        member.characters!.find((character) => character.isMain) ?? member.characters![0];
      return {
        memberId: member.id,
        discordName: member.discordName,
        rank: rankOf(member),
        main: main ? { name: main.name, class: main.characterClass } : null,
        leftAt: member.leftDiscordAt!.toISOString(),
      };
    }),
  };
}
