import type { GuildAccess } from '@wgm/shared';

/**
 * Who can do what in a guild, from the App permissions table in requirements.md. Permissions
 * don't follow rank order, so every action lists its ranks. Each story adds its actions here,
 * with tests.
 */
export const PERMISSIONS = {
  /** Open the guild's pages. */
  viewGuild: ['guild_master', 'officer'],
  /** Edit the guild name and image. */
  editGuildProfile: ['guild_master'],
  /** Connect the guild's Discord server. */
  connectDiscordServer: ['guild_master'],
  /** Choose the Discord role that grants Officer. */
  chooseOfficerRole: ['guild_master'],
} as const satisfies Record<string, readonly GuildAccess[]>;

export type GuildAction = keyof typeof PERMISSIONS;

export function can(access: GuildAccess | null, action: GuildAction): boolean {
  return access !== null && (PERMISSIONS[action] as readonly GuildAccess[]).includes(access);
}
