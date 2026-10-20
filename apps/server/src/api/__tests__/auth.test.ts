import { MemoryStore } from 'express-session';
import type { Sequelize } from 'sequelize';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { DiscordOAuth, DiscordProfile } from '../../auth/discord-oauth.js';
import { User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { createTestLogger } from '../../test-logger.js';
import { createApp } from '../app.js';

const up = () => Promise.resolve();

/** A fake Discord that returns `profile` for the code "good-code". */
function fakeDiscord(profile: DiscordProfile): DiscordOAuth {
  return {
    authorizeUrl: (state) => `https://discord.test/authorize?state=${state}`,
    fetchProfile: (code) =>
      code === 'good-code' ? Promise.resolve(profile) : Promise.reject(new Error('bad code')),
  };
}

const thrall: DiscordProfile = { id: '80351110224678912', name: 'Thrall', avatar: 'a1b2c3' };

function testApp(options: { oauth?: DiscordOAuth | null; secure?: boolean } = {}) {
  const store = new MemoryStore();
  const app = createApp({
    logger: createTestLogger().logger,
    healthChecks: { database: up, redis: up },
    auth: {
      store,
      secret: 'test-secret-that-is-at-least-32-characters',
      secure: options.secure ?? false,
      oauth: options.oauth === undefined ? fakeDiscord(thrall) : options.oauth,
    },
    trustProxy: options.secure ?? false,
  });
  return { app, store, agent: request.agent(app) };
}

/** Starts the login and returns the state that was sent to Discord. */
async function startLogin(agent: ReturnType<typeof request.agent>, locale = 'en') {
  const response = await agent.get(`/api/auth/discord/login?locale=${locale}`);
  expect(response.status).toBe(302);
  const state = new URL(response.headers.location as string).searchParams.get('state');
  expect(state).toBeTruthy();
  return state!;
}

function sessionCookie(response: request.Response): string | undefined {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
  return cookies?.find((cookie) => cookie.startsWith('wgm.sid='));
}

let sequelize: Sequelize;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
});

describe('Discord login', () => {
  it('logs in through Discord and returns the user from /api/me', async () => {
    const { agent } = testApp();

    const state = await startLogin(agent);
    const callback = await agent.get(`/api/auth/discord/callback?code=good-code&state=${state}`);

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe('/');
    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      id: expect.any(Number) as unknown,
      discordId: thrall.id,
      name: 'Thrall',
      avatarUrl: `https://cdn.discordapp.com/avatars/${thrall.id}/a1b2c3.png?size=64`,
      locale: 'en',
    });
  });

  it('starts a new session on login, so the pre-login session ID is useless', async () => {
    const { agent } = testApp();
    const start = await agent.get('/api/auth/discord/login');
    const state = new URL(start.headers.location as string).searchParams.get('state')!;

    const callback = await agent.get(`/api/auth/discord/callback?code=good-code&state=${state}`);

    expect(sessionCookie(callback)).toBeDefined();
    expect(sessionCookie(callback)?.split(';')[0]).not.toBe(sessionCookie(start)?.split(';')[0]);
  });

  it.each([
    ['a wrong state', 'state=not-the-state'],
    ['no state', ''],
  ])('rejects a callback with %s', async (_case, stateParam) => {
    const { agent } = testApp();
    await startLogin(agent);

    const callback = await agent.get(`/api/auth/discord/callback?code=good-code&${stateParam}`);

    expect(callback.headers.location).toBe('/login?error=failed');
    expect((await agent.get('/api/me')).status).toBe(401);
    expect(await User.count()).toBe(0);
  });

  it('rejects a state that was already used', async () => {
    const { agent } = testApp();
    const state = await startLogin(agent);
    await agent.post('/api/auth/logout');

    const callback = await agent.get(`/api/auth/discord/callback?code=good-code&state=${state}`);

    expect(callback.headers.location).toBe('/login?error=failed');
  });

  it('sends the user back to the login page when they cancel on Discord', async () => {
    const { agent } = testApp();
    const state = await startLogin(agent);

    const callback = await agent.get(
      `/api/auth/discord/callback?error=access_denied&state=${state}`,
    );

    expect(callback.headers.location).toBe('/login?error=cancelled');
  });

  it('sends the user back to the login page when Discord fails', async () => {
    const { agent } = testApp();
    const state = await startLogin(agent);

    const callback = await agent.get(`/api/auth/discord/callback?code=bad-code&state=${state}`);

    expect(callback.headers.location).toBe('/login?error=failed');
  });

  it('explains that login is off when the Discord credentials are missing', async () => {
    const { agent } = testApp({ oauth: null });

    const response = await agent.get('/api/auth/discord/login');

    expect(response.headers.location).toBe('/login?error=not_configured');
  });
});

describe('the app user', () => {
  it('takes the web app language on first login, then keeps their own', async () => {
    const first = testApp().agent;
    let state = await startLogin(first, 'es');
    await first.get(`/api/auth/discord/callback?code=good-code&state=${state}`);
    expect((await first.get('/api/me')).body).toMatchObject({ locale: 'es' });

    const otherDevice = testApp({
      oauth: fakeDiscord({ ...thrall, name: 'Go’el', avatar: null }),
    }).agent;
    state = await startLogin(otherDevice, 'en');
    await otherDevice.get(`/api/auth/discord/callback?code=good-code&state=${state}`);

    const me = await otherDevice.get('/api/me');
    expect(me.body).toMatchObject({ locale: 'es', name: 'Go’el' });
    expect((me.body as { avatarUrl: string }).avatarUrl).toMatch(
      /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/\d\.png$/,
    );
    expect(await User.count()).toBe(1);
  });

  it('saves a new language with PATCH /api/me', async () => {
    const { agent } = testApp();
    const state = await startLogin(agent);
    await agent.get(`/api/auth/discord/callback?code=good-code&state=${state}`);

    const updated = await agent.patch('/api/me').send({ locale: 'es' });
    const invalid = await agent.patch('/api/me').send({ locale: 'fr' });

    expect(updated.body).toMatchObject({ locale: 'es' });
    expect((await User.findOne())?.locale).toBe('es');
    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({
      error: { code: 'VALIDATION_ERROR', issues: [{ field: 'locale', code: 'INVALID_VALUE' }] },
    });
  });
});

describe('sessions', () => {
  it('answers 401 to /api/me without a session', async () => {
    const response = await request(testApp().app).get('/api/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('destroys the session on logout', async () => {
    const { agent, store } = testApp();
    const state = await startLogin(agent);
    await agent.get(`/api/auth/discord/callback?code=good-code&state=${state}`);

    const logout = await agent.post('/api/auth/logout');

    expect(logout.status).toBe(204);
    expect((await agent.get('/api/me')).status).toBe(401);
    const sessions = await new Promise((resolve) => store.all((_err, all) => resolve(all)));
    expect(sessions).toEqual({});
  });

  it('uses an httpOnly, SameSite=Lax cookie that lasts 30 days', async () => {
    const response = await testApp().agent.get('/api/auth/discord/login');

    const cookie = sessionCookie(response)!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).not.toMatch(/Secure/);
    const expires = new Date(/Expires=([^;]+)/.exec(cookie)![1]!).getTime();
    expect(expires - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });

  it('marks the cookie Secure outside development, behind an HTTPS proxy', async () => {
    const response = await testApp({ secure: true })
      .agent.get('/api/auth/discord/login')
      .set('X-Forwarded-Proto', 'https');

    expect(sessionCookie(response)).toMatch(/Secure/);
  });
});
