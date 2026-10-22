import { COMBAT_ROLE_NAMES } from '@wgm/shared';

import { directMessageLocale } from '../../bot/locale.js';
import { Character, Event, Guild, Member } from '../../db/models/index.js';
import { replaceAtDeadline, takeReminders } from '../../domain/tentative.js';
import { translator } from '../../i18n/index.js';
import type { DirectMessenger } from '../../integrations/discord/direct-messages.js';
import type { Logger } from '../../logger.js';
import type { JobPayloads } from '../definitions.js';
import type { JobEnqueuer } from '../queue.js';
import { notifySignUpChanges } from '../sign-up-notices.js';

export interface TentativeJobDependencies {
  logger: Logger;
  /** Null when the worker has no bot token: reminders aren't sent then. */
  messenger: DirectMessenger | null;
  jobs: JobEnqueuer;
}

/** A Discord timestamp: each reader sees it in their own time zone. */
const when = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:F>`;

export function tentativeHandlers({ logger, messenger, jobs }: TentativeJobDependencies) {
  return {
    /** Each Tentative participant who hasn't had it gets the reminder, once. */
    'tentative-reminder': async ({ eventId }: JobPayloads['tentative-reminder']) => {
      if (!messenger) {
        logger.warn({ eventId }, 'No bot token, so no Tentative reminders');
        return;
      }
      const signUps = await takeReminders(eventId);
      if (signUps.length === 0) return;
      const event = (await Event.findByPk(eventId, { include: [{ model: Guild, as: 'guild' }] }))!;
      for (const signUp of signUps) {
        const [member, character] = await Promise.all([
          Member.findByPk(signUp.memberId),
          Character.findByPk(signUp.characterId),
        ]);
        if (!member || !character) continue;
        const t = translator(
          directMessageLocale({
            lastUsedLocale: member.locale ?? undefined,
            guildLocale: event.guild!.discordLocale,
          }),
        );
        const sent = await messenger.send(
          member.discordUserId,
          t('signUpNotices.reminder', {
            event: event.name,
            time: when(event.startsAt),
            character: character.name,
            role: COMBAT_ROLE_NAMES[signUp.role!],
            deadline: when(event.tentativeDeadlineAt),
          }),
        );
        if (sent === 'blocked') {
          logger.info({ memberId: member.id }, 'Member does not accept direct messages');
        }
      }
    },

    /** Tentative participants give their spots to the waitlist; both sides are told. */
    'tentative-deadline': async ({ eventId }: JobPayloads['tentative-deadline']) => {
      await notifySignUpChanges(jobs, await replaceAtDeadline(eventId));
    },
  };
}
