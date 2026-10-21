import type { AutocompleteInteraction } from 'discord.js';

import { memberOnServer } from '../../domain/roster.js';

/** Discord shows at most 25 suggestions. */
const MAX_SUGGESTIONS = 25;

/**
 * Suggests the member's own characters on the roster whose name starts with what they typed,
 * for commands like /main and /character remove.
 */
export async function suggestOwnCharacters(interaction: AutocompleteInteraction): Promise<void> {
  const typed = interaction.options.getFocused().trim().toLowerCase();
  const { member } = interaction.inGuild()
    ? await memberOnServer(interaction.guildId, interaction.user.id)
    : { member: null };
  const names = (member?.characters ?? [])
    .map((character) => character.name)
    .filter((name) => name.toLowerCase().startsWith(typed))
    .slice(0, MAX_SUGGESTIONS);
  await interaction.respond(names.map((name) => ({ name, value: name })));
}
