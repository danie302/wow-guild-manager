/**
 * Discord data the API reads with the bot token (see "Discord data in the API" in
 * docs/tech-decisions.md). The login only has the `identify` scope, so the user's own token
 * can't be used. Tests use a fake.
 */
export interface DiscordDirectory {
  /** The servers the bot is in. */
  botServers(): Promise<DiscordServerSummary[]>;
  /** A server with its roles, or null when the bot isn't in it. */
  server(serverId: string): Promise<DiscordServer | null>;
  /** A user's membership in a server, or null when they aren't in it. */
  member(serverId: string, userId: string): Promise<DiscordMember | null>;
  /**
   * The IDs of every member with a role. It reads the whole member list, so it's only for
   * specific moments (a guild is created or its Officer role changes), never per request.
   */
  membersWithRole(serverId: string, roleId: string): Promise<string[]>;
  /**
   * Server members whose name starts with `query`, at most `limit`. One REST call per search,
   * so it's only for the add-member form, never per request.
   */
  searchMembers(serverId: string, query: string, limit: number): Promise<DiscordMemberProfile[]>;
}

export interface DiscordServerSummary {
  id: string;
  name: string;
  /** The icon hash; null when the server has none. */
  icon: string | null;
}

export interface DiscordServer extends DiscordServerSummary {
  ownerId: string;
  roles: DiscordRole[];
}

export interface DiscordRole {
  id: string;
  name: string;
  /** RGB as a number; 0 means no color. */
  color: number;
  /** Higher is shown first in Discord. */
  position: number;
  /** The role's permission bits. */
  permissions: bigint;
  /** Managed by an integration (a bot's own role, server boosts), so it can't be given by hand. */
  managed: boolean;
}

export interface DiscordMemberProfile {
  id: string;
  /** Their name in the server: nickname, then display name, then username. */
  name: string;
  /** The avatar hash; null for the default avatar. */
  avatar: string | null;
}

export interface DiscordMember extends DiscordMemberProfile {
  roleIds: string[];
}

/** Thrown when Discord can't be reached or returns an unexpected error. */
export class DiscordUnavailableError extends Error {
  override name = 'DiscordUnavailableError';
}

const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

/**
 * Whether a member can manage the server, worked out as Discord does: the owner can do
 * anything, and otherwise the permissions of `@everyone` (whose ID is the server's) and of
 * the member's roles add up. Administrator includes Manage Server.
 */
export function canManageServer(
  server: DiscordServer,
  userId: string,
  member: Pick<DiscordMember, 'roleIds'>,
): boolean {
  if (server.ownerId === userId) return true;
  const roleIds = new Set([server.id, ...member.roleIds]);
  const permissions = server.roles
    .filter((role) => roleIds.has(role.id))
    .reduce((bits, role) => bits | role.permissions, 0n);
  return (permissions & (ADMINISTRATOR | MANAGE_GUILD)) !== 0n;
}

/** Roles that can grant Officer: not `@everyone` or roles managed by integrations, highest first. */
export function officerRoleOptions(server: DiscordServer): DiscordRole[] {
  return server.roles
    .filter((role) => role.id !== server.id && !role.managed)
    .sort((a, b) => b.position - a.position);
}

export function discordServerIconUrl(server: DiscordServerSummary): string | null {
  return server.icon
    ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png?size=64`
    : null;
}

export function discordRoleColor(role: DiscordRole): string | null {
  return role.color === 0 ? null : `#${role.color.toString(16).padStart(6, '0')}`;
}
