import { DiscordAPIError, REST, Routes, type APIChannel } from 'discord.js';

/** Discord's error code when a user doesn't accept direct messages from the bot. */
const CANNOT_MESSAGE_USER = 50007;

/**
 * Sends direct messages with the bot token. Only the worker uses it, so messages never hold up
 * a request or a bot interaction. Tests use a fake.
 */
export interface DirectMessenger {
  /**
   * Sends `content` to the user. Resolves "blocked" when they don't accept direct messages
   * (closed DMs, or no server in common), which retrying won't fix. Throws on other failures,
   * so the job is retried.
   */
  send(userId: string, content: string): Promise<'sent' | 'blocked'>;
}

/** discord.js's REST client waits out rate limits. */
export function createRestDirectMessenger(botToken: string): DirectMessenger {
  const rest = new REST({ version: '10' }).setToken(botToken);

  return {
    async send(userId, content) {
      try {
        const channel = (await rest.post(Routes.userChannels(), {
          body: { recipient_id: userId },
        })) as APIChannel;
        await rest.post(Routes.channelMessages(channel.id), { body: { content } });
        return 'sent';
      } catch (err) {
        if (err instanceof DiscordAPIError && err.code === CANNOT_MESSAGE_USER) return 'blocked';
        throw err;
      }
    },
  };
}
