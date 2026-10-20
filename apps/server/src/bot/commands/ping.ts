import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { translator } from '../../i18n/index.js';
import { discordLocalizations } from '../locale.js';
import type { SlashCommand } from './types.js';

const en = translator('en');

export const ping: SlashCommand = {
  definition: new SlashCommandBuilder()
    .setName('ping')
    .setDescription(en('commands.ping.description'))
    .setDescriptionLocalizations(discordLocalizations('commands.ping.description'))
    .toJSON(),

  async execute(interaction, { t }) {
    await interaction.reply({ content: t('commands.ping.reply'), flags: MessageFlags.Ephemeral });
  },
};
