import { randomUUID } from 'node:crypto';

import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  FakeDiscordDirectory,
  MANAGE_GUILD,
  role,
  server,
} from '../../../../test/fake-discord-directory.js';
import { cachedDiscordDirectory } from '../cached-directory.js';

const redis = createClient({ url: process.env.REDIS_URL });

beforeAll(async () => {
  await redis.connect();
});

afterAll(async () => {
  await redis.close();
});

function setup() {
  const fake = new FakeDiscordDirectory().addServer(
    server('300000000000000001', 'Ashen Vanguard', {
      roles: [role('400000000000000001', 'Officers', { permissions: MANAGE_GUILD })],
    }),
  );
  const cached = cachedDiscordDirectory(fake, { redis, prefix: `test:${randomUUID()}:` });
  return { fake, cached };
}

describe('cachedDiscordDirectory', () => {
  it('reads a server from Discord once, keeping its permission bits', async () => {
    const { fake, cached } = setup();

    const first = await cached.server('300000000000000001');
    const second = await cached.server('300000000000000001');

    expect(second).toEqual(first);
    expect(second?.roles[1]?.permissions).toBe(MANAGE_GUILD);
    expect(fake.calls).toBe(1);
  });

  it('caches a member who is not in the server', async () => {
    const { fake, cached } = setup();

    expect(await cached.member('300000000000000001', '200000000000000001')).toBeNull();
    expect(await cached.member('300000000000000001', '200000000000000001')).toBeNull();
    expect(fake.calls).toBe(1);
  });

  it("doesn't cache the bot's servers, so a server shows up right after the bot joins", async () => {
    const { fake, cached } = setup();
    await cached.botServers();

    fake.addServer(server('300000000000000002', 'Emberwatch'));

    expect((await cached.botServers()).map((s) => s.name)).toEqual([
      'Ashen Vanguard',
      'Emberwatch',
    ]);
  });
});
