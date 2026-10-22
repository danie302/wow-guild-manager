import {
  COMBAT_ROLE_NAMES,
  COMBAT_ROLES,
  type CharacterClass,
  type CombatRole,
  type DiscordEmbed,
  type Locale,
  type SignUpPlacement,
} from '@wgm/shared';

import type { Event, SignUp } from '../db/models/index.js';
import { translator } from '../i18n/index.js';

/** The accent of the event posts, and the gray of cancelled ones. */
const POST_COLOR = 0xdcae55;
const CANCELLED_COLOR = 0x80848e;

/** Discord's limit for a field's value. */
const FIELD_MAX_LENGTH = 1024;

/** The lines joined, cut short with "+N" when they don't fit in a field. */
function fieldValue(lines: string[], more: (count: number) => string): string {
  for (let shown = lines.length; shown > 0; shown--) {
    const rest = lines.length - shown;
    const value = [...lines.slice(0, shown), ...(rest > 0 ? [more(rest)] : [])].join('\n');
    if (value.length <= FIELD_MAX_LENGTH) return value;
  }
  return more(lines.length);
}

/** A Discord timestamp: each reader sees it in their own time zone and language. */
const timestamp = (date: Date, style: 'D' | 'F' | 'R' | 't') =>
  `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;

/** An empty field name: Discord requires one, and the post's headings are in the values. */
const BLANK = '\u200b';

/** The icons a post uses, as Discord emoji markup (see integrations/discord/app-emojis.ts). */
export interface PostEmojis {
  /** A class without an icon shows none. */
  classes: Partial<Record<CharacterClass, string>>;
  roles: Record<CombatRole, string>;
}

/** Until the app has its own role icons. */
export const NO_EMOJIS: PostEmojis = {
  classes: {},
  roles: { tank: '🛡️', healer: '➕', dps: '⚔️' },
};

export interface EventPostDetails {
  /** From `eventSignUps`: with their characters, in sign-up order. */
  signUps: SignUp[];
  /** Who created the event; null when that account no longer exists. */
  leader: string | null;
  emojis?: PostEmojis;
}

/**
 * The embed the bot posts for an event, in the guild's Discord language, laid out like the
 * raid bots players know: a header with who leads it, how many signed up, and when; a column
 * per role with each character's class icon, sign-up number, and name; then the waitlist,
 * who declined, and when Tentative sign-ups close. The number is the order of sign-up across
 * the event. The web app's preview shows the same embed, so it matches the real post.
 */
export function eventPostEmbed(
  event: Event,
  locale: Locale,
  { signUps, leader, emojis = NO_EMOJIS }: EventPostDetails,
): DiscordEmbed {
  const t = translator(locale);
  const cancelled = event.cancelledAt !== null;
  const slots = { tank: event.tankSlots, healer: event.healerSlots, dps: event.dpsSlots };
  const more = (count: number) => t('eventPost.more', { count });

  const active = signUps.filter((signUp) => signUp.placement !== null);
  const number = new Map(active.map((signUp, index) => [signUp, index + 1]));
  const placed = (role: CombatRole, placement: SignUpPlacement) =>
    active.filter((signUp) => signUp.role === role && signUp.placement === placement);
  const line = (signUp: SignUp, prefix = '') => {
    const icon = emojis.classes[signUp.character!.characterClass];
    const tentative = signUp.status === 'tentative' ? ` *(${t('eventPost.tentative')})*` : '';
    return [prefix, icon, `\`${number.get(signUp)}\``, `**${signUp.character!.name}**${tentative}`]
      .filter(Boolean)
      .join(' ');
  };
  const waitlist = COMBAT_ROLES.flatMap((role) =>
    placed(role, 'waitlist').map((signUp) => line(signUp, emojis.roles[role])),
  );
  const declined = signUps.filter((signUp) => signUp.status === 'declined');
  const description = [cancelled && `**${t('eventPost.cancelled')}**`, event.description]
    .filter(Boolean)
    .join('\n\n');

  return {
    title: cancelled ? `~~${event.name}~~` : event.name,
    ...(description && { description }),
    color: cancelled ? CANCELLED_COLOR : POST_COLOR,
    fields: [
      {
        name: BLANK,
        value: `🚩 ${leader ?? '—'}\n📅 ${timestamp(event.startsAt, 'D')}`,
        inline: true,
      },
      {
        name: BLANK,
        value: `👥 **${active.length}**\n🕐 ${timestamp(event.startsAt, 't')}`,
        inline: true,
      },
      { name: BLANK, value: `${BLANK}\n⏳ ${timestamp(event.startsAt, 'R')}`, inline: true },
      ...COMBAT_ROLES.filter((role) => slots[role] > 0).map((role) => {
        const filled = placed(role, 'slot');
        const heading = `${emojis.roles[role]} __**${COMBAT_ROLE_NAMES[role]}**__ (${filled.length}/${slots[role]})`;
        return {
          name: BLANK,
          value: fieldValue(
            [heading, ...(filled.length > 0 ? filled.map((s) => line(s)) : ['—'])],
            more,
          ),
          inline: true,
        };
      }),
      {
        name: `${t('eventPost.waitlist')} (${waitlist.length})`,
        value: waitlist.length > 0 ? fieldValue(waitlist, more) : t('eventPost.waitlistEmpty'),
      },
      ...(declined.length > 0
        ? [
            {
              name: `${t('eventPost.declinedList')} (${declined.length})`,
              value: fieldValue(
                [declined.map((signUp) => signUp.character!.name).join(', ')],
                more,
              ),
            },
          ]
        : []),
      ...(cancelled
        ? []
        : [
            {
              name: t('eventPost.signUps'),
              value: t('eventPost.tentativeCloses', {
                time: timestamp(event.tentativeDeadlineAt, 'F'),
              }),
            },
          ]),
    ],
  };
}

/** The buttons under the post, as the preview shows them (the bot builds the real ones). */
export function eventPostButtonLabels(
  locale: Locale,
): { label: string; style: 'primary' | 'secondary' }[] {
  const t = translator(locale);
  return [
    { label: t('eventPost.signUp'), style: 'primary' },
    { label: t('eventPost.declined'), style: 'secondary' },
  ];
}
