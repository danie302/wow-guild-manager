import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import type { SlashCommand } from './types.js';

// Placeholder English text. Story 035 translates it and adds Discord localizations.
export const ping: SlashCommand = {
  definition: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check that the bot is online')
    .toJSON(),

  async execute(interaction) {
    await interaction.reply({ content: 'Pong!', flags: MessageFlags.Ephemeral });
  },
};
