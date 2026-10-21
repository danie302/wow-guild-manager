import { directMessageLocale } from '../../bot/locale.js';
import { Guild, Registration } from '../../db/models/index.js';
import { translator } from '../../i18n/index.js';
import type { DirectMessenger } from '../../integrations/discord/direct-messages.js';
import type { Logger } from '../../logger.js';
import type { JobPayloads } from '../definitions.js';

export interface RegistrationJobDependencies {
  logger: Logger;
  /** Null when the worker has no bot token: the result isn't sent then. */
  messenger: DirectMessenger | null;
}

export function registrationHandlers({ logger, messenger }: RegistrationJobDependencies) {
  return {
    'registration-reviewed': async ({ registrationId }: JobPayloads['registration-reviewed']) => {
      const registration = await Registration.findByPk(registrationId, {
        include: [{ model: Guild, as: 'guild' }],
      });
      // Gone with a disbanded guild, or not reviewed (the job only runs after a review).
      if (!registration || registration.status === 'pending') return;
      if (!messenger) {
        logger.warn({ registrationId }, 'No bot token, so no direct message');
        return;
      }

      const t = translator(
        directMessageLocale({
          lastUsedLocale: registration.locale ?? undefined,
          guildLocale: registration.guild!.discordLocale,
        }),
      );
      const guild = registration.guild!.name;
      const content =
        registration.status === 'approved'
          ? t('registrations.directMessage.approved', { guild })
          : t('registrations.directMessage.rejected', { guild });
      const sent = await messenger.send(registration.discordUserId, content);
      if (sent === 'blocked') {
        logger.info({ registrationId }, 'Member does not accept direct messages');
      }
    },
  };
}
