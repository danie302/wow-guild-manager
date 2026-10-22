import {
  COMBAT_ROLE_NAMES,
  COMBAT_ROLE_PLURAL_NAMES,
  COMBAT_ROLES,
  rolesFor,
  type CombatRole,
  type Locale,
} from '@wgm/shared';

import { Character, Member, SignUp, type Event, type Guild } from '../db/models/index.js';
import { translator } from '../i18n/index.js';
import { rankResolver } from './ranks.js';
import { canJoin } from './sign-ups.js';

/** Discord's limits: a message's length, and the users it can mention. */
const MESSAGE_MAX_LENGTH = 2000;
const MAX_MENTIONS = 100;

export interface MissingRole {
  role: CombatRole;
  missing: number;
  /** Discord user IDs of members who could fill it and haven't signed up. */
  candidates: string[];
}

/**
 * The event's roles with open slots, and who could fill each: active roster members (not
 * flagged as having left Discord) whose rank can join the event, with a character whose class
 * can fill the role, and no sign-up for the event at all (Declined counts as an answer).
 */
export async function missingRoles(event: Event, guild: Guild): Promise<MissingRole[]> {
  const slots = { tank: event.tankSlots, healer: event.healerSlots, dps: event.dpsSlots };
  const signUps = await SignUp.findAll({ where: { eventId: event.id } });
  const filled = (role: CombatRole) =>
    signUps.filter((signUp) => signUp.role === role && signUp.placement === 'slot').length;
  const open = COMBAT_ROLES.filter((role) => slots[role] > filled(role));
  if (open.length === 0) return [];

  const signedUp = new Set(signUps.map((signUp) => signUp.memberId));
  const rankOf = await rankResolver(guild);
  const members = await Member.findAll({
    where: { guildId: guild.id, removedAt: null, leftDiscordAt: null },
    include: [{ model: Character, as: 'characters', where: { removedAt: null } }],
    order: [['discordName', 'ASC']],
  });
  const eligible = members.filter(
    (member) => !signedUp.has(member.id) && canJoin(rankOf(member), event.type),
  );
  return open.map((role) => ({
    role,
    missing: slots[role] - filled(role),
    candidates: eligible
      .filter((member) =>
        member.characters!.some((character) => rolesFor(character.characterClass).includes(role)),
      )
      .map((member) => member.discordUserId),
  }));
}

/**
 * The alert's text in the guild's language: the event and when it starts (a Discord
 * timestamp), then a line per role with how many are missing and mentions of who could come.
 * Mentions are cut short to fit Discord's limits. Resolves the text and the mentioned users.
 */
export function missingRoleAlert(
  event: Event,
  locale: Locale,
  roles: MissingRole[],
): { content: string; mentions: string[] } {
  const t = translator(locale);
  const start = `<t:${Math.floor(event.startsAt.getTime() / 1000)}:F>`;
  const header = `⚠️ **${event.name}** – ${start}`;
  const budget = MESSAGE_MAX_LENGTH - header.length - roles.length * 80;
  const mentions: string[] = [];
  let used = 0;
  const lines = roles.map(({ role, missing, candidates }) => {
    const label = t('missingRoles.stillNeeded', {
      count: missing,
      role: missing === 1 ? COMBAT_ROLE_NAMES[role] : COMBAT_ROLE_PLURAL_NAMES[role],
    });
    const shown: string[] = [];
    for (const id of candidates) {
      const mention = `<@${id}>`;
      if (mentions.length >= MAX_MENTIONS || used + mention.length + 1 > budget) break;
      if (!mentions.includes(id)) mentions.push(id);
      shown.push(mention);
      used += mention.length + 1;
    }
    const rest = candidates.length - shown.length;
    const more = rest > 0 ? ` ${t('eventPost.more', { count: rest })}` : '';
    return shown.length > 0 ? `${label}: ${shown.join(' ')}${more}` : `${label}.`;
  });
  return { content: [header, ...lines].join('\n'), mentions };
}
