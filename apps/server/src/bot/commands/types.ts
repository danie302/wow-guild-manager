import type { Locale } from '@wgm/shared';
import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  StringSelectMenuInteraction,
} from 'discord.js';

import type { Translate } from '../../i18n/index.js';
import type { JobEnqueuer } from '../../jobs/index.js';

/** What a command needs to answer in the member's language, and to hand work to the worker. */
export interface CommandContext {
  locale: Locale;
  t: Translate;
  /** Adds background jobs (e.g. direct messages); missing in tests that don't need it. */
  jobs?: JobEnqueuer;
}

export interface SlashCommand {
  definition: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void>;
  /** Suggests values for an option with autocomplete while the member types. */
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
  /**
   * Handles clicks on the buttons the command's replies show. Their custom IDs start with the
   * command name and ":" (e.g. "character:remove:<id>"), and carry what the click needs.
   */
  button?(interaction: ButtonInteraction, context: CommandContext): Promise<void>;
}

/**
 * Buttons and select menus that aren't a command's replies, such as the ones on event posts.
 * Their custom IDs start with `name` and ":".
 */
export interface ComponentHandler {
  name: string;
  button?(interaction: ButtonInteraction, context: CommandContext): Promise<void>;
  select?(interaction: StringSelectMenuInteraction, context: CommandContext): Promise<void>;
}
