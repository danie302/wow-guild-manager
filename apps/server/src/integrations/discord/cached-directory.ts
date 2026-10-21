import type { RedisClientType } from 'redis';

import type { DiscordDirectory, DiscordMember, DiscordServer } from './directory.js';

export interface DiscordCacheOptions {
  redis: Pick<RedisClientType, 'get' | 'set'>;
  /** How long a server or member stays cached. */
  ttlSeconds?: number;
  /** Key prefix; tests give each test its own. */
  prefix?: string;
}

/**
 * Caches servers and members in Redis for a short time, to stay within Discord's rate limits.
 * Missing ones are cached too. The bot's server list isn't cached, so a server shows up right
 * after the bot is added to it.
 */
export function cachedDiscordDirectory(
  directory: DiscordDirectory,
  { redis, ttlSeconds = 60, prefix = 'discord:' }: DiscordCacheOptions,
): DiscordDirectory {
  async function cached<T>(
    key: string,
    load: () => Promise<T>,
    encode: (value: T) => unknown,
    decode: (json: never) => T,
  ): Promise<T> {
    const hit = await redis.get(prefix + key);
    if (hit !== null) return decode(JSON.parse(hit) as never);
    const value = await load();
    await redis.set(prefix + key, JSON.stringify(encode(value)), { EX: ttlSeconds });
    return value;
  }

  return {
    botServers: () => directory.botServers(),

    server: (serverId) =>
      cached(
        `server:${serverId}`,
        () => directory.server(serverId),
        // Permission bits are bigints, which JSON can't hold.
        (server) =>
          server && {
            ...server,
            roles: server.roles.map((role) => ({ ...role, permissions: String(role.permissions) })),
          },
        (json: CachedServer | null): DiscordServer | null =>
          json && {
            ...json,
            roles: json.roles.map((role) => ({ ...role, permissions: BigInt(role.permissions) })),
          },
      ),

    member: (serverId, userId) =>
      cached(
        `member:${serverId}:${userId}`,
        () => directory.member(serverId, userId),
        (member) => member,
        (json: DiscordMember | null) => json,
      ),
  };
}

type CachedServer = Omit<DiscordServer, 'roles'> & {
  roles: (Omit<DiscordServer['roles'][number], 'permissions'> & { permissions: string })[];
};
