import { CHARACTER_NAME_MAX_LENGTH } from '@wgm/shared';
import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { chooseMainByName, memberOnServer } from '../../domain/roster.js';
import { translator } from '../../i18n/index.js';
import { discordLocalizations } from '../locale.js';
import type { SlashCommand } from './types.js';

const en = translator('en');
const CHARACTER_OPTION = 'character';
/** Discord shows at most 25 suggestions. */
const MAX_SUGGESTIONS = 25;

/** `/main <character>`: the member picks their main among their characters on the roster. */
export const main: SlashCommand = {
  definition: new SlashCommandBuilder()
    .setName('main')
    .setDescription(en('commands.main.description'))
    .setDescriptionLocalizations(discordLocalizations('commands.main.description'))
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName(CHARACTER_OPTION)
        .setNameLocalizations(discordLocalizations('commands.main.characterOption.name'))
        .setDescription(en('commands.main.characterOption.description'))
        .setDescriptionLocalizations(
          discordLocalizations('commands.main.characterOption.description'),
        )
        .setRequired(true)
        .setMaxLength(CHARACTER_NAME_MAX_LENGTH)
        .setAutocomplete(true),
    )
    .toJSON(),

  async execute(interaction, { t }) {
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    if (!interaction.inGuild()) return void (await reply(t('commands.main.noGuild')));

    const name = interaction.options.getString(CHARACTER_OPTION, true);
    const outcome = await chooseMainByName(interaction.guildId, interaction.user.id, name);
    switch (outcome.result) {
      case 'changed':
        return void (await reply(t('commands.main.changed', { name: outcome.name })));
      case 'already_main':
        return void (await reply(t('commands.main.alreadyMain', { name: outcome.name })));
      case 'no_guild':
        return void (await reply(t('commands.main.noGuild')));
      case 'not_on_roster':
        return void (await reply(t('commands.main.notOnRoster', { guild: outcome.guild.name })));
      case 'not_your_character':
        return void (await reply(t('commands.main.notYourCharacter', { name: name.trim() })));
    }
  },

  /** Suggests the member's characters whose name starts with what they typed. */
  async autocomplete(interaction) {
    const typed = interaction.options.getFocused().trim().toLowerCase();
    const { member } = interaction.inGuild()
      ? await memberOnServer(interaction.guildId, interaction.user.id)
      : { member: null };
    const names = (member?.characters ?? [])
      .map((character) => character.name)
      .filter((name) => name.toLowerCase().startsWith(typed))
      .slice(0, MAX_SUGGESTIONS);
    await interaction.respond(names.map((name) => ({ name, value: name })));
  },
};
