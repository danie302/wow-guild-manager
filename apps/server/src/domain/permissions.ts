import { BASE_RANKS, type GuildAccess, type Rank } from '@wgm/shared';

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
  /** See the roster and each member's page. */
  viewRoster: ['guild_master', 'officer'],
  /** Add members and characters by hand, and approve requests to join (/register). */
  addCharacters: ['guild_master', 'officer'],
  /** Change a member's rank between Raider and Member (Officers: see canChangeRankOf). */
  changeMemberRank: ['guild_master', 'officer'],
  /** Remove any member from the roster (except the Guild Master, who can't be removed). */
  removeAnyMember: ['guild_master'],
  /** Remove Raiders and Members from the roster. */
  removeRaidersAndMembers: ['guild_master', 'officer'],
  /** Read and write officer notes. */
  officerNotes: ['guild_master', 'officer'],
  /** Change a member's main character. */
  changeMainCharacter: ['guild_master', 'officer'],
} as const satisfies Record<string, readonly GuildAccess[]>;

export type GuildAction = keyof typeof PERMISSIONS;

export function can(access: GuildAccess | null, action: GuildAction): boolean {
  return access !== null && (PERMISSIONS[action] as readonly GuildAccess[]).includes(access);
}

const isRaiderOrMember = (rank: Rank) => (BASE_RANKS as readonly Rank[]).includes(rank);

/** Officers can change the rank of Raiders and Members only; the Guild Master, of anyone. */
export function canChangeRankOf(access: GuildAccess | null, targetRank: Rank): boolean {
  return (
    can(access, 'changeMemberRank') && (access === 'guild_master' || isRaiderOrMember(targetRank))
  );
}

/** The Guild Master can remove anyone; Officers, only Raiders and Members. */
export function canRemove(access: GuildAccess | null, targetRank: Rank): boolean {
  return (
    can(access, 'removeAnyMember') ||
    (can(access, 'removeRaidersAndMembers') && isRaiderOrMember(targetRank))
  );
}
