import { CHARACTER_NAME_MAX_LENGTH } from '@wgm/shared';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

import { ownCharacter, removeOwnCharacter, type OwnCharacterRefusal } from '../../domain/roster.js';
import { translator, type Translate } from '../../i18n/index.js';
import { notifySignUpChanges } from '../../jobs/sign-up-notices.js';
import { discordLocalizations } from '../locale.js';
import { suggestOwnCharacters } from './own-characters.js';
import type { SlashCommand } from './types.js';

const en = translator('en');
const CHARACTER_OPTION = 'character';
/** Button custom IDs: "character:remove:<character ID>" and "character:cancel". */
const REMOVE_BUTTON = 'character:remove:';
const CANCEL_BUTTON = 'character:cancel';

/**
 * `/character remove <character>`: a member removes one of their own characters from the
 * roster, after confirming with a button. Only they see the replies.
 */
export const character: SlashCommand = {
  definition: new SlashCommandBuilder()
    .setName('character')
    .setDescription(en('commands.character.description'))
    .setDescriptionLocalizations(discordLocalizations('commands.character.description'))
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setNameLocalizations(discordLocalizations('commands.character.remove.name'))
        .setDescription(en('commands.character.remove.description'))
        .setDescriptionLocalizations(discordLocalizations('commands.character.remove.description'))
        .addStringOption((option) =>
          option
            .setName(CHARACTER_OPTION)
            .setNameLocalizations(discordLocalizations('commands.character.characterOption.name'))
            .setDescription(en('commands.character.characterOption.description'))
            .setDescriptionLocalizations(
              discordLocalizations('commands.character.characterOption.description'),
            )
            .setRequired(true)
            .setMaxLength(CHARACTER_NAME_MAX_LENGTH)
            .setAutocomplete(true),
        ),
    )
    .toJSON(),

  async execute(interaction, { t }) {
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    if (!interaction.inGuild()) return void (await reply(t('commands.character.noGuild')));

    const name = interaction.options.getString(CHARACTER_OPTION, true);
    const own = await ownCharacter(interaction.guildId, interaction.user.id, { name });
    if (own.result !== 'found') return void (await reply(refusal(own, name.trim(), t)));

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(REMOVE_BUTTON + own.character.id)
        .setLabel(t('commands.character.remove.confirmButton'))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(CANCEL_BUTTON)
        .setLabel(t('commands.character.remove.cancelButton'))
        .setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({
      content: t(
        own.character.isMain
          ? 'commands.character.remove.confirmMain'
          : 'commands.character.remove.confirm',
        { name: own.character.name },
      ),
      components: [buttons],
      flags: MessageFlags.Ephemeral,
    });
  },

  autocomplete: suggestOwnCharacters,

  /** Confirm or Cancel on the question. Either way, the question is replaced by the result. */
  async button(interaction, { t, jobs }) {
    const done = (content: string) => interaction.update({ content, components: [] });
    if (!interaction.customId.startsWith(REMOVE_BUTTON) || !interaction.inGuild()) {
      return void (await done(t('commands.character.remove.cancelled')));
    }

    const outcome = await removeOwnCharacter(
      interaction.guildId,
      interaction.user.id,
      interaction.customId.slice(REMOVE_BUTTON.length),
    );
    if (outcome.result !== 'removed') return void (await done(refusal(outcome, '', t)));
    // Its spots in upcoming events go to the waitlist.
    if (jobs) await notifySignUpChanges(jobs, outcome.changes);
    await done(
      outcome.newMain
        ? t('commands.character.remove.removedNewMain', {
            name: outcome.name,
            main: outcome.newMain,
          })
        : t('commands.character.remove.removed', { name: outcome.name }),
    );
  },
};

function refusal(outcome: OwnCharacterRefusal, name: string, t: Translate): string {
  switch (outcome.result) {
    case 'no_guild':
      return t('commands.character.noGuild');
    case 'not_on_roster':
      return t('commands.character.notOnRoster', { guild: outcome.guild.name });
    case 'not_your_character':
      // A confirmation can come after the character was removed some other way.
      return name
        ? t('commands.character.notYourCharacter', { name })
        : t('commands.character.remove.gone');
  }
}
