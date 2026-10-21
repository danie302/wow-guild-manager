import { Event, Guild, User } from '../../db/models/index.js';
import { transaction } from '../../db/transaction.js';
import { eventPostEmbed, NO_EMOJIS, type PostEmojis } from '../../domain/event-post.js';
import { eventSignUps } from '../../domain/sign-ups.js';
import { eventPostButtons } from '../../bot/sign-up.js';
import {
  ChannelMessageError,
  type ChannelMessage,
  type ChannelMessages,
} from '../../integrations/discord/channel-messages.js';
import type { Logger } from '../../logger.js';
import type { JobPayloads } from '../definitions.js';

export interface EventPostJobDependencies {
  logger: Logger;
  /** Null when the worker has no bot token: posts aren't sent then. */
  channelMessages: ChannelMessages | null;
  /** The class and role icons; without it, the fallback ones. */
  emojis?: () => Promise<PostEmojis>;
}

export function eventPostHandlers({
  logger,
  channelMessages,
  emojis = () => Promise.resolve(NO_EMOJIS),
}: EventPostJobDependencies) {
  return {
    'event-post': async ({ eventId }: JobPayloads['event-post']) => {
      if (!channelMessages) {
        logger.warn({ eventId }, 'No bot token, so the event is not posted');
        return;
      }
      await syncEventPost(eventId, channelMessages, logger, await emojis());
    },

    'event-post-delete': async ({ channelId, messageId }: JobPayloads['event-post-delete']) => {
      if (channelMessages) await removeQuietly(channelMessages, channelId, messageId, logger);
    },
  };
}

/**
 * Brings the event's post in line with the event and its guild: posts it in the events
 * channel, edits it, posts it again if it was deleted in Discord, or moves it when the channel
 * changed. A cancelled event's post stays where it is, marked as cancelled. When Discord
 * refuses (the bot lost its permissions, the channel is gone), the reason is stored on the
 * event for the event page; any other failure throws, so the job is retried.
 */
export async function syncEventPost(
  eventId: string,
  channelMessages: ChannelMessages,
  logger: Logger,
  emojis: PostEmojis = NO_EMOJIS,
): Promise<void> {
  await transaction(async () => {
    // Runs for one event take turns, so two of them never post it twice. An advisory lock
    // instead of the event row's, so sign-ups don't wait for Discord.
    await Event.sequelize!.query('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))', {
      replacements: { key: `event-post-${eventId}` },
    });
    const event = await Event.findByPk(eventId, {
      include: [
        { model: Guild, as: 'guild' },
        { model: User, as: 'createdBy', attributes: ['name'] },
      ],
    });
    if (!event) return;
    const guild = event.guild!;
    const channelId = event.cancelledAt ? event.discordChannelId : guild.eventsChannelId;

    if (event.discordMessageId && event.discordChannelId !== channelId) {
      await removeQuietly(channelMessages, event.discordChannelId!, event.discordMessageId, logger);
      await event.update({ discordChannelId: null, discordMessageId: null });
    }
    if (!channelId) {
      await event.update({ discordPostError: null });
      return;
    }

    const message: ChannelMessage = {
      embeds: [
        eventPostEmbed(event, guild.discordLocale, {
          signUps: await eventSignUps(event.id),
          leader: event.createdBy?.name ?? null,
          emojis,
        }),
      ],
      // A cancelled event's post has no buttons.
      components: event.cancelledAt ? [] : [eventPostButtons(event.id, guild.discordLocale)],
    };
    try {
      if (event.discordMessageId && (await editOrMissing(channelMessages, event, message))) {
        await event.update({ discordPostError: null });
        return;
      }
      const messageId = await channelMessages.post(channelId, message);
      await event.update({
        discordChannelId: channelId,
        discordMessageId: messageId,
        discordPostError: null,
      });
    } catch (err) {
      if (!(err instanceof ChannelMessageError) || err.reason === 'message_not_found') throw err;
      logger.warn({ eventId, channelId, reason: err.reason }, 'Discord refused the event post');
      await event.update({ discordPostError: err.reason });
    }
  });
}

/** Edits the post; resolves false when it was deleted in Discord, so it's posted again. */
async function editOrMissing(
  channelMessages: ChannelMessages,
  event: Event,
  message: ChannelMessage,
): Promise<boolean> {
  try {
    await channelMessages.edit(event.discordChannelId!, event.discordMessageId!, message);
    return true;
  } catch (err) {
    if (err instanceof ChannelMessageError && err.reason === 'message_not_found') return false;
    throw err;
  }
}

/** Deletes an old post. If Discord refuses, the post stays and the job goes on. */
async function removeQuietly(
  channelMessages: ChannelMessages,
  channelId: string,
  messageId: string,
  logger: Logger,
): Promise<void> {
  try {
    await channelMessages.remove(channelId, messageId);
  } catch (err) {
    if (!(err instanceof ChannelMessageError)) throw err;
    logger.info({ channelId, messageId, reason: err.reason }, 'Could not delete an old post');
  }
}
