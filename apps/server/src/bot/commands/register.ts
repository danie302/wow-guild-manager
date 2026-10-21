import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { requestToJoin } from '../../domain/registrations.js';
import { translator } from '../../i18n/index.js';
import { discordLocalizations, fromDiscordLocale } from '../locale.js';
import type { SlashCommand } from './types.js';

const en = translator('en');

/**
 * `/register`: asks to join the roster of this server's guild, for an Officer to approve.
 * Characters aren't part of it: Officers add them in the web app.
 */
export const register: SlashCommand = {
  definition: new SlashCommandBuilder()
    .setName('register')
    .setDescription(en('commands.register.description'))
    .setDescriptionLocalizations(discordLocalizations('commands.register.description'))
    .setContexts(InteractionContextType.Guild)
    .toJSON(),

  async execute(interaction, { t }) {
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    if (!interaction.inGuild()) return void (await reply(t('commands.register.noGuild')));

    const member = interaction.inCachedGuild() ? interaction.member : null;
    const outcome = await requestToJoin(
      interaction.guildId,
      {
        discordUserId: interaction.user.id,
        discordName: member?.displayName ?? interaction.user.displayName,
        discordAvatar: interaction.user.avatar,
      },
      fromDiscordLocale(interaction.locale) ?? null,
    );
    if (outcome.result === 'no_guild') return void (await reply(t('commands.register.noGuild')));
    const key = {
      created: 'commands.register.created',
      on_roster: 'commands.register.onRoster',
      already_pending: 'commands.register.alreadyPending',
    } as const;
    await reply(t(key[outcome.result], { guild: outcome.guild.name }));
  },
};
