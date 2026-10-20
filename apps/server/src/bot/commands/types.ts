import type { Locale } from '@wgm/shared';
import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

import type { Translate } from '../../i18n/index.js';

/** What a command needs to answer in the member's language. */
export interface CommandContext {
  locale: Locale;
  t: Translate;
}

export interface SlashCommand {
  definition: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void>;
}
