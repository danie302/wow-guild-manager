import {
  DiscordUnavailableError,
  type DiscordDirectory,
  type DiscordMember,
  type DiscordRole,
  type DiscordServer,
} from '../src/integrations/discord/directory.js';

export const MANAGE_GUILD = 1n << 5n;
export const ADMINISTRATOR = 1n << 3n;

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
  /** Set to make every call fail as if Discord were down. */
  down = false;
  calls = 0;

  addServer(server: DiscordServer): this {
    this.servers.set(server.id, server);
    return this;
  }

  addMember(serverId: string, userId: string, roleIds: string[] = []): this {
    this.members.set(`${serverId}/${userId}`, { roleIds });
    return this;
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

  private answer<T>(value: () => T): Promise<T> {
    this.calls += 1;
    return this.down
      ? Promise.reject(new DiscordUnavailableError('Discord is down'))
      : Promise.resolve(value());
  }
}
