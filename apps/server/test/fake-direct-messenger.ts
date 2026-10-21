import type { DirectMessenger } from '../src/integrations/discord/direct-messages.js';

/** Keeps the direct messages instead of sending them. */
export class FakeDirectMessenger implements DirectMessenger {
  readonly sent: { userId: string; content: string }[] = [];
  /** Users who don't accept direct messages. */
  readonly blocked = new Set<string>();

  send(userId: string, content: string): Promise<'sent' | 'blocked'> {
    if (this.blocked.has(userId)) return Promise.resolve('blocked');
    this.sent.push({ userId, content });
    return Promise.resolve('sent');
  }
}
