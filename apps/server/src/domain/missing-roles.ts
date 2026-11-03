import {
  COMBAT_ROLE_NAMES,
  COMBAT_ROLE_PLURAL_NAMES,
  COMBAT_ROLES,
  type CombatRole,
  type Locale,
} from '@wgm/shared';

import { SignUp, type Event } from '../db/models/index.js';
import { translator } from '../i18n/index.js';

/** When the event's missing-role check runs: its alert time before the start. */
export function missingRoleCheckAt(event: Pick<Event, 'startsAt' | 'missingRoleAlertHours'>): Date {
  return new Date(event.startsAt.getTime() - event.missingRoleAlertHours * 60 * 60 * 1000);
}

export interface MissingRole {
  role: CombatRole;
  missing: number;
}

/** The event's roles with open slots (Confirmed and Tentative fill them), and how many. */
export async function missingRoles(event: Event): Promise<MissingRole[]> {
  const slots = { tank: event.tankSlots, healer: event.healerSlots, dps: event.dpsSlots };
  const signUps = await SignUp.findAll({ where: { eventId: event.id, placement: 'slot' } });
  const filled = (role: CombatRole) => signUps.filter((signUp) => signUp.role === role).length;
  return COMBAT_ROLES.filter((role) => slots[role] > filled(role)).map((role) => ({
    role,
    missing: slots[role] - filled(role),
  }));
}

/**
 * The alert's text in the guild's language: the event and when it starts (a Discord
 * timestamp), a line per role with how many are missing, and a mention of the guild's Guild
 * Member role at the end, if it has one. Resolves the text and the mentioned roles.
 */
export function missingRoleAlert(
  event: Event,
  locale: Locale,
  roles: MissingRole[],
  memberRoleId: string | null,
): { content: string; mentionRoleIds: string[] } {
  const t = translator(locale);
  const start = `<t:${Math.floor(event.startsAt.getTime() / 1000)}:F>`;
  const header = `⚠️ **${event.name}** – ${start}`;
  const lines = roles.map(({ role, missing }) =>
    t('missingRoles.stillNeeded', {
      count: missing,
      role: missing === 1 ? COMBAT_ROLE_NAMES[role] : COMBAT_ROLE_PLURAL_NAMES[role],
    }),
  );
  const mention = memberRoleId ? [`<@&${memberRoleId}>`] : [];
  return {
    content: [header, ...lines, ...mention].join('\n'),
    mentionRoleIds: memberRoleId ? [memberRoleId] : [],
  };
}
