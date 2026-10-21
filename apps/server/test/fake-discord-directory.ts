import {
  DiscordUnavailableError,
  type DiscordChannel,
  type DiscordDirectory,
  type DiscordMember,
  type DiscordRole,
  type DiscordServer,
} from '../src/integrations/discord/directory.js';

export const MANAGE_GUILD = 1n << 5n;
export const ADMINISTRATOR = 1n << 3n;
export const VIEW_CHANNEL = 1n << 10n;
export const SEND_MESSAGES = 1n << 11n;
export const EMBED_LINKS = 1n << 14n;
/** What the bot needs in the events channel. */
export const POST_PERMISSIONS = VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS;

/** The bot's user ID in tests (Discord's application ID is the bot's user ID). */
export const BOT_USER_ID = '100000000000000099';

/** A text channel with no overwrites unless given. */
export function channel(
  id: string,
  name: string,
  extra: Partial<DiscordChannel> = {},
): DiscordChannel {
  return { id, name, type: 'text', position: 0, parentId: null, overwrites: [], ...extra };
}

/** A role for `server.roles`, with no permissions unless given. */
export function role(id: string, name: string, extra: Partial<DiscordRole> = {}): DiscordRole {
  return { id, name, color: 0, position: 1, permissions: 0n, managed: false, ...extra };
}

/** A server whose `@everyone` role (ID = server ID) has no permissions. */
export function server(id: string, name: string, extra: Partial<DiscordServer> = {}) {
  return {
    id,
    name,
    icon: null,
    ownerId: '1000000000000000000',
    ...extra,
    roles: [role(id, '@everyone', { position: 0 }), ...(extra.roles ?? [])],
  } satisfies DiscordServer;
}

/** Discord in memory: the servers the bot is in and their members. */
export class FakeDiscordDirectory implements DiscordDirectory {
  readonly servers = new Map<string, DiscordServer>();
  readonly members = new Map<string, DiscordMember>();
  readonly serverChannels = new Map<string, DiscordChannel[]>();
  /** Set to make every call fail as if Discord were down. */
  down = false;
  calls = 0;

  addServer(server: DiscordServer): this {
    this.servers.set(server.id, server);
    return this;
  }

  addMember(serverId: string, userId: string, roleIds: string[] = [], name?: string): this {
    const known = this.members.get(`${serverId}/${userId}`);
    this.members.set(`${serverId}/${userId}`, {
      id: userId,
      name: name ?? known?.name ?? `User ${userId.slice(-4)}`,
      avatar: null,
      roleIds,
    });
    return this;
  }

  /**
   * Gives the server these channels and adds the bot to it with a role that can post in every
   * channel, unless `botRoleIds` says otherwise.
   */
  addChannels(serverId: string, channels: DiscordChannel[], botRoleIds?: string[]): this {
    this.serverChannels.set(serverId, channels);
    const server = this.servers.get(serverId);
    if (server && !botRoleIds) {
      const botRole = role(`${serverId.slice(0, -2)}99`, 'Guild Manager', {
        managed: true,
        permissions: POST_PERMISSIONS,
      });
      server.roles = [...server.roles.filter((r) => r.id !== botRole.id), botRole];
      botRoleIds = [botRole.id];
    }
    return this.addMember(serverId, BOT_USER_ID, botRoleIds ?? [], 'Guild Manager');
  }

  channels(serverId: string) {
    return this.answer(() => this.serverChannels.get(serverId) ?? []);
  }

  botServers() {
    return this.answer(() =>
      [...this.servers.values()].map(({ id, name, icon }) => ({ id, name, icon })),
    );
  }

  server(serverId: string) {
    return this.answer(() => this.servers.get(serverId) ?? null);
  }

  member(serverId: string, userId: string) {
    return this.answer(() => this.members.get(`${serverId}/${userId}`) ?? null);
  }

  membersWithRole(serverId: string, roleId: string) {
    return this.answer(() =>
      [...this.members.entries()]
        .filter(
          ([key, member]) => key.startsWith(`${serverId}/`) && member.roleIds.includes(roleId),
        )
        .map(([key]) => key.slice(serverId.length + 1)),
    );
  }

  searchMembers(serverId: string, query: string, limit: number) {
    return this.answer(() =>
      [...this.members.entries()]
        .filter(([key]) => key.startsWith(`${serverId}/`))
        .map(([, { id, name, avatar }]) => ({ id, name, avatar }))
        .filter((member) => member.name.toLowerCase().startsWith(query.toLowerCase()))
        .slice(0, limit),
    );
  }

  private answer<T>(value: () => T): Promise<T> {
    this.calls += 1;
    return this.down
      ? Promise.reject(new DiscordUnavailableError('Discord is down'))
      : Promise.resolve(value());
  }
}
