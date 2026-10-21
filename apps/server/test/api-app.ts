import { MemoryStore } from 'express-session';
import request from 'supertest';
import { expect } from 'vitest';

import type { DiscordAccess } from '../src/api/discord.js';
import { createApp } from '../src/api/app.js';
import type { DiscordOAuth, DiscordProfile } from '../src/auth/discord-oauth.js';
import type { FileStorage } from '../src/storage/file-storage.js';
import { createTestLogger } from '../src/test-logger.js';

const up = () => Promise.resolve();

/** A fake Discord login: the code is the Discord ID of the user who logs in. */
const fakeOAuth: DiscordOAuth = {
  authorizeUrl: (state) => `https://discord.test/authorize?state=${state}`,
  fetchProfile: (code) =>
    Promise.resolve({
      id: code,
      name: `User ${code.slice(-4)}`,
      avatar: null,
    } satisfies DiscordProfile),
};

/** The API with sessions, a fake Discord login, and the given Discord access. */
export function testApp(discord: DiscordAccess | null = null, storage?: FileStorage) {
  return createApp({
    logger: createTestLogger().logger,
    healthChecks: { database: up, redis: up },
    auth: {
      store: new MemoryStore(),
      secret: 'test-secret-that-is-at-least-32-characters',
      secure: false,
      oauth: fakeOAuth,
    },
    discord,
    ...(storage && { storage }),
  });
}

/** A Supertest agent logged in as the Discord user `discordId`. */
export async function loginAs(app: ReturnType<typeof testApp>, discordId: string) {
  const agent = request.agent(app);
  const start = await agent.get('/api/auth/discord/login');
  const state = new URL(start.headers.location as string).searchParams.get('state')!;
  const callback = await agent.get(`/api/auth/discord/callback?code=${discordId}&state=${state}`);
  expect(callback.headers.location).toBe('/');
  return agent;
}
