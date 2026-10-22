import { COMBAT_ROLE_NAMES } from '@wgm/shared';
import { Op } from 'sequelize';

import { directMessageLocale } from '../../bot/locale.js';
import { Character, Event, Guild, Member, SignUp } from '../../db/models/index.js';
import { translator } from '../../i18n/index.js';
import type { DirectMessenger } from '../../integrations/discord/direct-messages.js';
import type { Logger } from '../../logger.js';
import type { JobPayloads } from '../definitions.js';

export interface SignUpNoticeDependencies {
  logger: Logger;
  /** Null when the worker has no bot token: the messages aren't sent then. */
  messenger: DirectMessenger | null;
}

/** A Discord timestamp: each reader sees it in their own time zone. */
const when = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:F>`;

/**
 * Direct messages about sign-ups changed by someone else. Each re-reads the data first and
 * says nothing if it no longer holds (the event started or was cancelled, the sign-up moved
 * again), so a late job never sends a stale message.
 */
export function signUpNoticeHandlers({ logger, messenger }: SignUpNoticeDependencies) {
  const send = async (member: Member, guild: Guild, content: (t: Translate) => string) => {
    if (!messenger) {
      logger.warn({ memberId: member.id }, 'No bot token, so no direct message');
      return;
    }
    const t = translator(
      directMessageLocale({
        lastUsedLocale: member.locale ?? undefined,
        guildLocale: guild.discordLocale,
      }),
    );
    if ((await messenger.send(member.discordUserId, content(t))) === 'blocked') {
      logger.info({ memberId: member.id }, 'Member does not accept direct messages');
    }
  };

  const upcomingSignUp = async (signUpId: string) => {
    const signUp = await SignUp.findByPk(signUpId, {
      include: [
        { model: Event, as: 'event', include: [{ model: Guild, as: 'guild' }] },
        { model: Member, as: 'member' },
        { model: Character, as: 'character' },
      ],
    });
    const event = signUp?.event;
    return signUp && event && !event.cancelledAt && event.startsAt > new Date() ? signUp : null;
  };

  /** A message about one sign-up: its event, time, character, and role. */
  const sendAbout = (
    signUp: SignUp,
    key: 'signUpNotices.promoted' | 'signUpNotices.movedToWaitlist',
  ) => {
    const event = signUp.event!;
    return send(signUp.member!, event.guild!, (t) =>
      t(key, {
        event: event.name,
        time: when(event.startsAt),
        character: signUp.character!.name,
        role: COMBAT_ROLE_NAMES[signUp.role!],
      }),
    );
  };

  return {
    'waitlist-promoted': async ({ signUpId }: JobPayloads['waitlist-promoted']) => {
      const signUp = await upcomingSignUp(signUpId);
      if (signUp?.placement === 'slot') await sendAbout(signUp, 'signUpNotices.promoted');
    },

    'moved-to-waitlist': async ({ signUpId }: JobPayloads['moved-to-waitlist']) => {
      const signUp = await upcomingSignUp(signUpId);
      if (signUp?.placement === 'waitlist') {
        await sendAbout(signUp, 'signUpNotices.movedToWaitlist');
      }
    },

    'events-rescheduled': async ({ memberId, eventIds }: JobPayloads['events-rescheduled']) => {
      const member = await Member.findByPk(memberId, { include: [{ model: Guild, as: 'guild' }] });
      if (!member || member.removedAt) return;
      // Only events they're still in that haven't started or been cancelled.
      const signUps = await SignUp.findAll({
        where: { memberId, eventId: eventIds, placement: { [Op.ne]: null } },
        include: [
          {
            model: Event,
            as: 'event',
            where: { cancelledAt: null, startsAt: { [Op.gt]: new Date() } },
          },
        ],
      });
      const events = signUps
        .map((signUp) => signUp.event!)
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      if (events.length === 0) return;
      await send(member, member.guild!, (t) =>
        [
          t('signUpNotices.rescheduled', { count: events.length }),
          ...events.map((event) => `• **${event.name}**: ${when(event.startsAt)}`),
        ].join('\n'),
      );
    },
  };
}

type Translate = ReturnType<typeof translator>;
