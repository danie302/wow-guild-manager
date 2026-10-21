import { FACTION_NAMES, type Faction } from '@wgm/shared';

import { directMessageLocale } from '../../bot/locale.js';
import { CharacterRegistration, Guild } from '../../db/models/index.js';
import { lookUpRegistration } from '../../domain/registrations.js';
import { translator } from '../../i18n/index.js';
import type { CharacterLookup } from '../../integrations/character-lookup/character-lookup.js';
import type { DirectMessenger } from '../../integrations/discord/direct-messages.js';
import type { Logger } from '../../logger.js';
import type { JobPayloads } from '../definitions.js';

export interface RegistrationJobDependencies {
  logger: Logger;
  characterLookup: CharacterLookup;
  /** Null when the worker has no bot token: the result isn't sent then. */
  messenger: DirectMessenger | null;
}

export function registrationHandlers({
  logger,
  characterLookup,
  messenger,
}: RegistrationJobDependencies) {
  /** Tells the member by direct message how their registration ended. */
  async function notify(registration: CharacterRegistration): Promise<void> {
    if (!messenger) {
      logger.warn({ registrationId: registration.id }, 'No bot token, so no direct message');
      return;
    }
    const guild = registration.guild!;
    const t = translator(directMessageLocale({ lastUsedLocale: registration.locale ?? undefined }));
    const values = { name: registration.name, guild: guild.name };
    const content =
      registration.status === 'approved'
        ? t('registrations.directMessage.approved', values)
        : registration.rejectionReason === 'wrong_faction'
          ? t('registrations.directMessage.wrongFaction', {
              ...values,
              faction: FACTION_NAMES[registration.faction as Faction],
              guildFaction: FACTION_NAMES[guild.faction],
            })
          : t('registrations.directMessage.rejected', values);

    const sent = await messenger.send(registration.discordUserId, content);
    if (sent === 'blocked') {
      logger.info({ registrationId: registration.id }, 'Member does not accept direct messages');
    }
  }

  return {
    'registration-lookup': async ({ registrationId }: JobPayloads['registration-lookup']) => {
      const rejected = await lookUpRegistration(registrationId, characterLookup);
      if (rejected) await notify(rejected);
    },

    'registration-reviewed': async ({ registrationId }: JobPayloads['registration-reviewed']) => {
      const registration = await CharacterRegistration.findByPk(registrationId, {
        include: [{ model: Guild, as: 'guild' }],
      });
      // Gone with a disbanded guild, or not reviewed (the job only runs after a review).
      if (registration?.status === 'approved' || registration?.status === 'rejected') {
        await notify(registration);
      }
    },
  };
}
