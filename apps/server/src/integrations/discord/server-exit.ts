import { DiscordAPIError, REST, Routes } from 'discord.js';

/** Makes the bot leave a Discord server, with the bot token. Only the worker uses it. */
export interface ServerExit {
  /** Resolves once the bot is out; a server it's already out of counts as done. */
  leave(serverId: string): Promise<void>;
}

/** Discord's error code when the bot isn't in the server. */
const UNKNOWN_GUILD = 10004;

export function createRestServerExit(botToken: string): ServerExit {
  const rest = new REST({ version: '10' }).setToken(botToken);
  return {
    async leave(serverId) {
      try {
        await rest.delete(Routes.userGuild(serverId));
      } catch (err) {
        if (err instanceof DiscordAPIError && err.code === UNKNOWN_GUILD) return;
        throw err;
      }
    },
  };
}
