import { EventEmitter } from 'node:events';

import { Events, type Client } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';

import { createTestLogger } from '../../test-logger.js';
import { watchDiscordChanges } from '../cache-events.js';

function setup() {
  const client = new EventEmitter();
  const cache = {
    forgetMember: vi.fn(() => Promise.resolve()),
    forgetServer: vi.fn(() => Promise.resolve()),
  };
  watchDiscordChanges(client as unknown as Client, cache, createTestLogger().logger);
  return { client, cache };
}

const member = { id: '200000000000000001', guild: { id: '300000000000000001' } };
const role = { id: '400000000000000001', guild: { id: '300000000000000001' } };

describe('watchDiscordChanges', () => {
  it.each([
    ['roles change', Events.GuildMemberUpdate, [{}, member]],
    ['they join', Events.GuildMemberAdd, [member]],
    ['they leave', Events.GuildMemberRemove, [member]],
  ])("forgets a member's cached roles when %s", (_case, event, args) => {
    const { client, cache } = setup();

    client.emit(event, ...args);

    expect(cache.forgetMember).toHaveBeenCalledWith('300000000000000001', '200000000000000001');
  });

  it.each([
    ['a role is created', Events.GuildRoleCreate, [role]],
    ['a role changes', Events.GuildRoleUpdate, [{}, role]],
    ['a role is deleted', Events.GuildRoleDelete, [role]],
    ['the server changes', Events.GuildUpdate, [{}, { id: '300000000000000001' }]],
    ['the bot leaves', Events.GuildDelete, [{ id: '300000000000000001' }]],
  ])('forgets the cached server when %s', (_case, event, args) => {
    const { client, cache } = setup();

    client.emit(event, ...args);

    expect(cache.forgetServer).toHaveBeenCalledWith('300000000000000001');
  });

  it('logs instead of crashing when Redis is down', async () => {
    const client = new EventEmitter();
    const { logger, lines } = createTestLogger();
    watchDiscordChanges(
      client as unknown as Client,
      { forgetMember: () => Promise.reject(new Error('down')), forgetServer: vi.fn() },
      logger,
    );

    client.emit(Events.GuildMemberRemove, member);

    await vi.waitFor(() => expect(lines()).toContainEqual(expect.objectContaining({ level: 40 })));
  });
});
