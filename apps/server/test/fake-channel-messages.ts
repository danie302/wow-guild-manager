import {
  ChannelMessageError,
  type ChannelMessage,
  type ChannelMessageFailure,
  type ChannelMessages,
} from '../src/integrations/discord/channel-messages.js';

/** Discord channels in memory: the bot's messages in each one. */
export class FakeChannelMessages implements ChannelMessages {
  /** Messages by channel ID, then message ID. */
  readonly channels = new Map<string, Map<string, ChannelMessage>>();
  /** Channels where Discord refuses, and why. */
  readonly refusing = new Map<string, ChannelMessageFailure>();
  /** Set to make every call fail as if Discord were down. */
  down = false;
  private nextId = 600000000000000001n;

  /** The channel's messages (an empty channel if it isn't known yet). */
  messages(channelId: string): Map<string, ChannelMessage> {
    let channel = this.channels.get(channelId);
    if (!channel) {
      channel = new Map();
      this.channels.set(channelId, channel);
    }
    return channel;
  }

  post(channelId: string, message: ChannelMessage): Promise<string> {
    return this.answer(channelId, () => {
      const id = String(this.nextId++);
      this.messages(channelId).set(id, message);
      return id;
    });
  }

  edit(channelId: string, messageId: string, message: ChannelMessage): Promise<void> {
    return this.answer(channelId, () => {
      if (!this.messages(channelId).has(messageId)) {
        throw new ChannelMessageError('message_not_found');
      }
      this.messages(channelId).set(messageId, message);
    });
  }

  remove(channelId: string, messageId: string): Promise<void> {
    return this.answer(channelId, () => {
      if (!this.messages(channelId).delete(messageId)) {
        throw new ChannelMessageError('message_not_found');
      }
    });
  }

  private answer<T>(channelId: string, work: () => T): Promise<T> {
    if (this.down) return Promise.reject(new Error('Discord is down'));
    const refusal = this.refusing.get(channelId);
    if (refusal) return Promise.reject(new ChannelMessageError(refusal));
    try {
      return Promise.resolve(work());
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
