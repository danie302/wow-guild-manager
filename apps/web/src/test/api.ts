import type { GuildResponse, MeResponse } from '@wgm/shared';
import { vi } from 'vitest';

export const testUser: MeResponse = {
  id: 1,
  discordId: '80351110224678912',
  name: 'Thrall',
  avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
  locale: 'en',
  timeZone: 'UTC',
  theme: 'dark',
  guilds: [{ id: 1, name: 'Ashen Vanguard', access: 'guild_master' }],
};

/** A logged-in user who doesn't lead or belong to any guild yet. */
export const userWithoutGuild: MeResponse = { ...testUser, guilds: [] };

export const testGuild: GuildResponse = {
  id: 1,
  name: 'Ashen Vanguard',
  faction: 'alliance',
  discordServer: { id: '300000000000000001', name: 'Ashen Vanguard Discord', iconUrl: null },
  officerRole: { id: '400000000000000001', name: 'Officers' },
};

type Handler = (init?: RequestInit) => Response | Promise<Response>;

/**
 * Fakes the API: each key is "METHOD /api/path" (or just "/api/path" for GET). Unlisted
 * requests answer 404. `GET /api/me` answers with `testUser`, and `GET /api/guilds/1` with
 * `testGuild`, unless a test overrides them.
 * Returns the fetch mock, to check the requests that were made.
 */
export function mockApi(handlers: Record<string, Handler> = {}) {
  const all: Record<string, Handler> = {
    'GET /api/me': () => Response.json(testUser),
    'GET /api/guilds/1': () => Response.json(testGuild),
  };
  for (const [key, handler] of Object.entries(handlers)) {
    all[key.startsWith('/') ? `GET ${key}` : key] = handler;
  }
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    const path = new URL(url, 'http://localhost').pathname;
    const method = init?.method ?? 'GET';
    const handler = all[`${method} ${path}`];
    return Promise.resolve(
      handler ? handler(init) : Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const notLoggedIn: Handler = () =>
  Response.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
