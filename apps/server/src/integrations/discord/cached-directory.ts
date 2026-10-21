import type { RedisClientType } from 'redis';

import type {
  DiscordChannel,
  DiscordDirectory,
  DiscordMember,
  DiscordMemberProfile,
  DiscordServer,
} from './directory.js';

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
    membersWithRole: (serverId, roleId) => directory.membersWithRole(serverId, roleId),

    // A short cache, so typing a name and deleting a letter doesn't search again.
    searchMembers: (serverId, query, limit) =>
      cached(
        `search:${serverId}:${limit}:${query.toLowerCase()}`,
        () => directory.searchMembers(serverId, query, limit),
        (members) => members,
        (json: DiscordMemberProfile[]) => json,
      ),

    server: (serverId) =>
      cached(
        serverKey(serverId),
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

    channels: (serverId) =>
      cached(
        channelsKey(serverId),
        () => directory.channels(serverId),
        (channels) =>
          channels.map((channel) => ({
            ...channel,
            overwrites: channel.overwrites.map((overwrite) => ({
              ...overwrite,
              allow: String(overwrite.allow),
              deny: String(overwrite.deny),
            })),
          })),
        (json: CachedChannel[]): DiscordChannel[] =>
          json.map((channel) => ({
            ...channel,
            overwrites: channel.overwrites.map((overwrite) => ({
              ...overwrite,
              allow: BigInt(overwrite.allow),
              deny: BigInt(overwrite.deny),
            })),
          })),
      ),

    member: (serverId, userId) =>
      cached(
        memberKey(serverId, userId),
        () => directory.member(serverId, userId),
        (member) => member,
        (json: DiscordMember | null) => json,
      ),
  };
}

const serverKey = (serverId: string) => `server:${serverId}`;
const memberKey = (serverId: string, userId: string) => `member:${serverId}:${userId}`;
const channelsKey = (serverId: string) => `channels:${serverId}`;

export interface DiscordCacheInvalidator {
  /** After a member's roles change, or they join or leave the server. */
  forgetMember(serverId: string, userId: string): Promise<void>;
  /** After the server's roles or owner change, or the bot leaves it. */
  forgetServer(serverId: string): Promise<void>;
  /** After a channel is created, changed (including its permissions), or deleted. */
  forgetChannels(serverId: string): Promise<void>;
}

/** Drops cached entries, so the next read sees the change. The bot calls it on Discord events. */
export function discordCacheInvalidator({
  redis,
  prefix = 'discord:',
}: {
  redis: Pick<RedisClientType, 'del'>;
  prefix?: string;
}): DiscordCacheInvalidator {
  return {
    forgetMember: async (serverId, userId) => {
      await redis.del(prefix + memberKey(serverId, userId));
    },
    forgetServer: async (serverId) => {
      await redis.del(prefix + serverKey(serverId));
    },
    forgetChannels: async (serverId) => {
      await redis.del(prefix + channelsKey(serverId));
    },
  };
}

type CachedServer = Omit<DiscordServer, 'roles'> & {
  roles: (Omit<DiscordServer['roles'][number], 'permissions'> & { permissions: string })[];
};

type CachedChannel = Omit<DiscordChannel, 'overwrites'> & {
  overwrites: (Omit<DiscordChannel['overwrites'][number], 'allow' | 'deny'> & {
    allow: string;
    deny: string;
  })[];
};
