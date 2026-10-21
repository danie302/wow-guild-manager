import { describe, expect, it, vi } from 'vitest';

import { NO_EMOJIS } from '../../../domain/event-post.js';
import { createTestLogger } from '../../../test-logger.js';
import { postEmojiSource, postEmojis, type AppEmojis } from '../app-emojis.js';

describe('postEmojis', () => {
  it('uses our emojis, and the fallback role icons for missing ones', () => {
    const emojis = postEmojis(
      new Map([
        ['wgm_mage', '111'],
        ['wgm_tank', '222'],
        ['party_parrot', '333'],
      ]),
    );

    expect(emojis).toEqual({
      classes: { mage: '<:wgm_mage:111>' },
      roles: { tank: '<:wgm_tank:222>', healer: '➕', dps: '⚔️' },
    });
  });
});

describe('postEmojiSource', () => {
  const fake = (list: AppEmojis['list']): AppEmojis => ({ list, upload: vi.fn() });

  it('reads Discord once while the cache lasts', async () => {
    const list = vi.fn(() => Promise.resolve(new Map([['wgm_mage', '111']])));
    const source = postEmojiSource(fake(list), createTestLogger().logger);

    await source();
    const second = await source();

    expect(second.classes.mage).toBe('<:wgm_mage:111>');
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('falls back to the plain icons when Discord fails, or without a bot token', async () => {
    const failing = postEmojiSource(
      fake(() => Promise.reject(new Error('down'))),
      createTestLogger().logger,
    );

    expect(await failing()).toEqual(NO_EMOJIS);
    expect(await postEmojiSource(null, createTestLogger().logger)()).toEqual(NO_EMOJIS);
  });
});
