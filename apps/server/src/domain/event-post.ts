import { COMBAT_ROLE_NAMES, COMBAT_ROLES, type DiscordEmbed, type Locale } from '@wgm/shared';

import type { Event } from '../db/models/index.js';
import { translator } from '../i18n/index.js';
import { tentativeDeadline } from './events.js';

/** The accent of the event posts, and the gray of cancelled ones. */
const POST_COLOR = 0xdcae55;
const CANCELLED_COLOR = 0x80848e;

/** A Discord timestamp: each reader sees it in their own time zone and language. */
const timestamp = (date: Date, style: 'F' | 'R') =>
  `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;

/**
 * The embed the bot posts for an event, in the guild's Discord language. The web app's
 * preview shows the same embed, so it matches the real post.
 */
export function eventPostEmbed(event: Event, locale: Locale): DiscordEmbed {
  const t = translator(locale);
  const cancelled = event.cancelledAt !== null;
  const slots = { tank: event.tankSlots, healer: event.healerSlots, dps: event.dpsSlots };
  const description = [cancelled && `**${t('eventPost.cancelled')}**`, event.description]
    .filter(Boolean)
    .join('\n\n');

  return {
    title: cancelled ? `~~${event.name}~~` : event.name,
    ...(description && { description }),
    color: cancelled ? CANCELLED_COLOR : POST_COLOR,
    fields: [
      {
        name: t('eventPost.date'),
        value: `${timestamp(event.startsAt, 'F')} (${timestamp(event.startsAt, 'R')})`,
      },
      // Sign-ups come in story 023, so every slot is still open.
      ...COMBAT_ROLES.filter((role) => slots[role] > 0).map((role) => ({
        name: `${COMBAT_ROLE_NAMES[role]} (0/${slots[role]})`,
        value: '—',
        inline: true,
      })),
      { name: t('eventPost.waitlist'), value: t('eventPost.waitlistEmpty') },
      ...(cancelled
        ? []
        : [
            {
              name: t('eventPost.signUps'),
              value: t('eventPost.tentativeCloses', {
                time: timestamp(tentativeDeadline(event), 'F'),
              }),
            },
          ]),
    ],
  };
}
