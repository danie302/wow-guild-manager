import type { DiscordEmbed } from '@wgm/shared';
import { DiscordAPIError, REST, Routes, type APIMessage } from 'discord.js';

/** Discord's error codes that retrying won't fix. */
const UNKNOWN_CHANNEL = 10003;
const UNKNOWN_MESSAGE = 10008;
const MISSING_ACCESS = 50001;
const MISSING_PERMISSIONS = 50013;

/** A message the bot posts in a channel. Story 023 adds the sign-up buttons. */
export interface ChannelMessage {
  embeds: DiscordEmbed[];
}

export type ChannelMessageFailure =
  'missing_permissions' | 'channel_not_found' | 'message_not_found';

/** Thrown when Discord refuses for a reason that retrying won't fix. */
export class ChannelMessageError extends Error {
  override name = 'ChannelMessageError';

  constructor(readonly reason: ChannelMessageFailure) {
    super(`Discord refused the message: ${reason}`);
  }
}

/**
 * Posts, edits, and deletes the bot's messages in server channels, with the bot token. Only the
 * worker uses it (event posts), so Discord never holds up a request. Tests use a fake.
 *
 * Each method throws ChannelMessageError when Discord refuses for a reason retrying won't fix,
 * and other errors when it fails otherwise, so the job is retried.
 */
export interface ChannelMessages {
  /** Posts the message and resolves its ID. */
  post(channelId: string, message: ChannelMessage): Promise<string>;
  edit(channelId: string, messageId: string, message: ChannelMessage): Promise<void>;
  remove(channelId: string, messageId: string): Promise<void>;
}

/** discord.js's REST client waits out rate limits. */
export function createRestChannelMessages(botToken: string): ChannelMessages {
  const rest = new REST({ version: '10' }).setToken(botToken);

  return {
    async post(channelId, message) {
      const posted = (await call(() =>
        rest.post(Routes.channelMessages(channelId), { body: message }),
      )) as APIMessage;
      return posted.id;
    },

    async edit(channelId, messageId, message) {
      await call(() => rest.patch(Routes.channelMessage(channelId, messageId), { body: message }));
    },

    async remove(channelId, messageId) {
      await call(() => rest.delete(Routes.channelMessage(channelId, messageId)));
    },
  };
}

async function call<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
    const reason = err instanceof DiscordAPIError ? failure(err.code) : undefined;
    if (reason) throw new ChannelMessageError(reason);
    throw err;
  }
}

function failure(code: number | string): ChannelMessageFailure | undefined {
  switch (code) {
    case UNKNOWN_CHANNEL:
      return 'channel_not_found';
    case UNKNOWN_MESSAGE:
      return 'message_not_found';
    case MISSING_ACCESS:
    case MISSING_PERMISSIONS:
      return 'missing_permissions';
    default:
      return undefined;
  }
}
