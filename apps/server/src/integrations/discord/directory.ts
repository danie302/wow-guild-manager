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
  /** A server's channels, with their permission overwrites. Empty when the bot isn't in it. */
  channels(serverId: string): Promise<DiscordChannel[]>;
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

export interface DiscordChannel {
  id: string;
  name: string;
  /** Only text and announcement channels can hold event posts. */
  type: 'text' | 'announcement' | 'category' | 'other';
  /** The order within its category. */
  position: number;
  /** Its category; null when it's in none. */
  parentId: string | null;
  overwrites: DiscordPermissionOverwrite[];
}

/** Permissions a channel gives or takes away from a role or a member. */
export interface DiscordPermissionOverwrite {
  /** The role's or member's ID. */
  id: string;
  type: 'role' | 'member';
  allow: bigint;
  deny: bigint;
}

/** Thrown when Discord can't be reached or returns an unexpected error. */
export class DiscordUnavailableError extends Error {
  override name = 'DiscordUnavailableError';
}

const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;
const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;
const EMBED_LINKS = 1n << 14n;
/** What the bot needs in the events channel: see it, write in it, and post embeds. */
const EVENT_POST_PERMISSIONS = VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS;

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
  return (serverPermissions(server, member) & (ADMINISTRATOR | MANAGE_GUILD)) !== 0n;
}

/** The permissions of `@everyone` (whose ID is the server's) and of the member's roles. */
function serverPermissions(server: DiscordServer, member: Pick<DiscordMember, 'roleIds'>): bigint {
  const roleIds = new Set([server.id, ...member.roleIds]);
  return server.roles
    .filter((role) => roleIds.has(role.id))
    .reduce((bits, role) => bits | role.permissions, 0n);
}

/**
 * A member's permissions in a channel, worked out as Discord does: the server permissions,
 * then the channel's overwrites for `@everyone`, for the member's roles (together), and for
 * the member. Administrator allows everything. The server owner isn't handled: it's for the bot.
 */
export function channelPermissions(
  server: DiscordServer,
  channel: DiscordChannel,
  member: Pick<DiscordMember, 'id' | 'roleIds'>,
): bigint {
  let bits = serverPermissions(server, member);
  if (bits & ADMINISTRATOR) return ~0n;
  const apply = (overwrites: DiscordPermissionOverwrite[]) => {
    const deny = overwrites.reduce((all, overwrite) => all | overwrite.deny, 0n);
    const allow = overwrites.reduce((all, overwrite) => all | overwrite.allow, 0n);
    bits = (bits & ~deny) | allow;
  };
  apply(channel.overwrites.filter((o) => o.type === 'role' && o.id === server.id));
  apply(channel.overwrites.filter((o) => o.type === 'role' && member.roleIds.includes(o.id)));
  apply(channel.overwrites.filter((o) => o.type === 'member' && o.id === member.id));
  return bits;
}

/**
 * Channels that can hold event posts: text and announcement channels where the bot can see,
 * write, and post embeds, in Discord's order (channels without a category first, then each
 * category in turn).
 */
export function eventChannelOptions(
  server: DiscordServer,
  channels: DiscordChannel[],
  bot: Pick<DiscordMember, 'id' | 'roleIds'>,
): { channel: DiscordChannel; category: DiscordChannel | null }[] {
  const categories = new Map(
    channels.filter((channel) => channel.type === 'category').map((c) => [c.id, c]),
  );
  return channels
    .filter((channel) => channel.type === 'text' || channel.type === 'announcement')
    .filter(
      (channel) =>
        (channelPermissions(server, channel, bot) & EVENT_POST_PERMISSIONS) ===
        EVENT_POST_PERMISSIONS,
    )
    .map((channel) => ({
      channel,
      category: (channel.parentId && categories.get(channel.parentId)) || null,
    }))
    .sort(
      (a, b) =>
        (a.category?.position ?? -1) - (b.category?.position ?? -1) ||
        a.channel.position - b.channel.position,
    );
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
