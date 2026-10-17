import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

export interface SlashCommand {
  /** The definition registered with Discord. Its name routes interactions to `execute`. */
  definition: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
