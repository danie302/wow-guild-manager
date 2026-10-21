import { CHARACTER_NAME_MAX_LENGTH, characterNameSchema } from '@wgm/shared';
import {
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';

import { registerCharacter } from '../../domain/registrations.js';
import { translator, type Translate } from '../../i18n/index.js';
import type { JobEnqueuer } from '../../jobs/index.js';
import { discordLocalizations, fromDiscordLocale } from '../locale.js';
import type { SlashCommand } from './types.js';

const en = translator('en');
const NAME_OPTION = 'name';

/**
 * `/register <name>`: registers one of the member's characters for the guild of this server,
 * for an Officer to approve. The worker looks the character up afterwards, so the reply
 * doesn't wait for Battle.net.
 */
export function registerCommand(jobs: JobEnqueuer): SlashCommand {
  return {
    definition: new SlashCommandBuilder()
      .setName('register')
      .setDescription(en('commands.register.description'))
      .setDescriptionLocalizations(discordLocalizations('commands.register.description'))
      .setContexts(InteractionContextType.Guild)
      .addStringOption((option) =>
        option
          .setName(NAME_OPTION)
          .setNameLocalizations(discordLocalizations('commands.register.nameOption.name'))
          .setDescription(en('commands.register.nameOption.description'))
          .setDescriptionLocalizations(
            discordLocalizations('commands.register.nameOption.description'),
          )
          .setRequired(true)
          .setMaxLength(CHARACTER_NAME_MAX_LENGTH),
      )
      .toJSON(),

    async execute(interaction, { t }) {
      const content = await register(interaction, jobs, t);
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    },
  };
}

async function register(
  interaction: ChatInputCommandInteraction,
  jobs: JobEnqueuer,
  t: Translate,
): Promise<string> {
  if (!interaction.inGuild()) return t('commands.register.noGuild');
  const parsed = characterNameSchema.safeParse(interaction.options.getString(NAME_OPTION, true));
  if (!parsed.success) {
    return t('commands.register.invalidName', { max: CHARACTER_NAME_MAX_LENGTH });
  }
  const name = parsed.data;

  const member = interaction.inCachedGuild() ? interaction.member : null;
  const outcome = await registerCharacter(
    interaction.guildId,
    {
      discordUserId: interaction.user.id,
      discordName: member?.displayName ?? interaction.user.displayName,
      discordAvatar: interaction.user.avatar,
    },
    name,
    fromDiscordLocale(interaction.locale) ?? null,
  );

  switch (outcome.result) {
    case 'created': {
      await jobs.enqueue('registration-lookup', { registrationId: outcome.registration.id });
      return t('commands.register.created', { name, guild: outcome.guild.name });
    }
    case 'no_guild':
      return t('commands.register.noGuild');
    case 'on_roster':
      return t('commands.register.onRoster', { name, guild: outcome.guild.name });
    case 'in_another_guild':
      return t('commands.register.inAnotherGuild', { name });
    case 'already_pending':
      return t('commands.register.alreadyPending', { name });
  }
}
