import { z } from 'zod';

import { SUPPORTED_LOCALES, type Locale } from './locales.js';
import { isValidTimeZone, normalizeTimeZone, THEMES, type Theme } from './preferences.js';
import type { BaseRank, CharacterClass, Faction, Profession, Race, Rank } from './game.js';
import { CHARACTER_ERROR_CODES } from './schemas/character.js';
import { GUILD_ERROR_CODES } from './schemas/guild.js';
import { ROSTER_ERROR_CODES } from './schemas/roster.js';

/** Codes for one invalid field. The generic ones come from Zod checks, the rest from game rules. */
export const VALIDATION_ISSUE_CODES = [
  'REQUIRED',
  'INVALID_TYPE',
  'INVALID_VALUE',
  'INVALID_FORMAT',
  'TOO_SHORT',
  'TOO_LONG',
  'TOO_SMALL',
  'TOO_BIG',
  'TOO_FEW',
  'TOO_MANY',
  'INVALID_TIME_ZONE',
  ...Object.values(CHARACTER_ERROR_CODES),
  ...Object.values(GUILD_ERROR_CODES),
  ...Object.values(ROSTER_ERROR_CODES),
] as const;

export type ValidationIssueCode = (typeof VALIDATION_ISSUE_CODES)[number];

export interface ValidationIssue {
  /** The field's path, e.g. "name" or "professions.1". Empty for the whole input. */
  field: string;
  code: ValidationIssueCode;
  /** Values the message needs, e.g. `{ count: 2 }` for "at most 2". */
  params?: Record<string, number | string>;
}

/**
 * Errors the API returns. The web client translates them; the API never sends user-facing
 * text. Codes with extra details carry them next to the code.
 */
export type ApiError =
  | {
      code:
        | 'NOT_FOUND'
        | 'INVALID_JSON'
        | 'INTERNAL_ERROR'
        | 'UNAUTHENTICATED'
        | 'FORBIDDEN'
        // The user already leads a guild, and can lead only one at a time.
        | 'ALREADY_LEADS_GUILD'
        // The Discord server is connected to another guild.
        | 'DISCORD_SERVER_TAKEN'
        // The server has no bot token, so it can't read Discord.
        | 'DISCORD_NOT_CONFIGURED'
        // Discord didn't answer or returned an error.
        | 'DISCORD_UNAVAILABLE'
        // An upload is bigger than allowed (the guild image: GUILD_IMAGE_MAX_BYTES).
        | 'FILE_TOO_LARGE'
        // An upload isn't one of the accepted types (the guild image: PNG, JPEG, or WebP).
        | 'UNSUPPORTED_FILE_TYPE'
        // The file says it's an image but can't be read as one.
        | 'INVALID_IMAGE'
        // The Discord user is already on this guild's roster.
        | 'MEMBER_ALREADY_ON_ROSTER'
        // The Guild Master can't leave the roster; they transfer leadership first.
        | 'GUILD_MASTER_CANNOT_BE_REMOVED'
        // The registration was already approved or rejected.
        | 'REGISTRATION_NOT_PENDING';
    }
  | { code: 'VALIDATION_ERROR'; issues: ValidationIssue[] };

export type ApiErrorCode = ApiError['code'];

export interface ApiErrorResponse {
  error: ApiError;
}

export type HealthStatus = 'up' | 'down';

export interface HealthResponse {
  status: 'ok' | 'error';
  checks: {
    database: HealthStatus;
    redis: HealthStatus;
  };
}

/** Every ID in the API is a UUID (v7). */
export const uuidSchema = z.uuid();

/** The logged-in app user, from `GET /api/me`. */
export interface MeResponse {
  id: string;
  discordId: string;
  name: string;
  avatarUrl: string;
  locale: Locale;
  /** IANA time zone name. Every date in the web app is shown in it. */
  timeZone: string;
  theme: Theme;
  /** The guilds the user can open, by name. */
  guilds: MeGuild[];
  /** False when the user already leads a guild, since a user leads at most one. */
  canCreateGuild: boolean;
}

/**
 * Why a user can open a guild: they're its Guild Master, or they have its Officer role in
 * Discord. Story 036 adds read-only access for roster members.
 */
export const GUILD_ACCESS = ['guild_master', 'officer'] as const;

export type GuildAccess = (typeof GUILD_ACCESS)[number];

/** A guild the user can open, and why. */
export interface MeGuild {
  id: string;
  name: string;
  /** Null when the guild has no image. */
  imageUrl: string | null;
  access: GuildAccess;
}

/** A Discord server the user could connect a guild to, from `GET /api/discord/servers`. */
export interface DiscordServerOption {
  id: string;
  name: string;
  /** Null when the server has no icon. */
  iconUrl: string | null;
  /** False when the server is already connected to a guild. */
  available: boolean;
}

export interface DiscordServersResponse {
  /** Servers where the bot is and the user can manage the server. */
  servers: DiscordServerOption[];
  /** Opens Discord's page for adding the bot to a server. */
  botInviteUrl: string;
}

export interface DiscordRoleOption {
  id: string;
  name: string;
  /** The role's color as a CSS hex color, or null when it has none. */
  color: string | null;
}

/** `GET /api/discord/servers/:serverId/roles`: roles that can grant Officer, highest first. */
export interface DiscordRolesResponse {
  roles: DiscordRoleOption[];
}

export interface GuildResponse {
  id: string;
  name: string;
  faction: Faction;
  /** Null when the guild has no image. */
  imageUrl: string | null;
  /** The logged-in user's access to this guild. */
  access: GuildAccess;
  /** `name` is null when Discord can't be read right now; the page still shows. */
  discordServer: { id: string; name: string | null; iconUrl: string | null };
  officerRole: { id: string; name: string | null };
}

/** An IANA time zone name, normalized to the runtime's spelling. */
export const timeZoneSchema = z
  .string()
  .refine(isValidTimeZone, { message: 'INVALID_TIME_ZONE' })
  .transform(normalizeTimeZone);

/** Body of `PATCH /api/me`: any of the user's own settings. */
export const updateMeSchema = z
  .object({
    locale: z.enum(SUPPORTED_LOCALES),
    timeZone: timeZoneSchema,
    theme: z.enum(THEMES),
  })
  .partial()
  .strict();

export type UpdateMeInput = z.infer<typeof updateMeSchema>;

/**
 * Why a login didn't finish, sent back to the login page as `?error=`. `cancelled`: the user
 * declined on Discord. `not_configured`: the server has no Discord application credentials.
 */
export const LOGIN_ERRORS = ['cancelled', 'failed', 'not_configured'] as const;

export type LoginError = (typeof LOGIN_ERRORS)[number];

export function isLoginError(value: unknown): value is LoginError {
  return LOGIN_ERRORS.includes(value as LoginError);
}

/** A character as the roster shows it. */
export interface RosterCharacter {
  id: string;
  name: string;
  faction: Faction;
  race: Race;
  class: CharacterClass;
  level: number;
  professions: Profession[];
  isMain: boolean;
}

/** A member on `GET /api/guilds/:guildId/members`. Characters come main first. */
export interface RosterMember {
  id: string;
  discordUserId: string;
  discordName: string;
  avatarUrl: string;
  /** Guild Master and Officer come from the guild and Discord; `baseRank` is set in the app. */
  rank: Rank;
  baseRank: BaseRank;
  characters: RosterCharacter[];
  /** When they left the guild's Discord server; null while they're in it. Officers only. */
  leftDiscordAt: string | null;
}

export interface RankHistoryEntry {
  id: string;
  /** Null for the first entry, when the member joined the roster. */
  fromRank: Rank | null;
  toRank: Rank;
  /** "discord": the Officer role was given or removed in Discord. */
  source: 'app' | 'discord';
  /** Who made the change in the app; null for Discord or a deleted account. */
  changedBy: string | null;
  at: string;
}

export interface OfficerNoteResponse {
  id: string;
  text: string;
  /** Null when the author's account no longer exists. */
  author: string | null;
  at: string;
}

/** `GET /api/guilds/:guildId/members/:memberId`: only the Guild Master and Officers. */
export interface MemberDetailResponse extends RosterMember {
  rankHistory: RankHistoryEntry[];
  officerNotes: OfficerNoteResponse[];
}

/** `POST /api/guilds/:guildId/members`. */
export interface AddMemberResponse {
  member: MemberDetailResponse;
  /** True when a removed member was added back with their old record. */
  restored: boolean;
  /** Names of a restored member's characters that stay removed (their name is taken now). */
  unrestoredCharacters: string[];
}

/** A request to join on `GET /api/guilds/:guildId/registrations`, oldest first. */
export interface PendingRegistration {
  id: string;
  discordUserId: string;
  discordName: string;
  avatarUrl: string;
  /** Added by hand since they asked, so approving only closes the request. */
  onRoster: boolean;
  /** They were removed from the roster; approving restores them with their characters. */
  returning: boolean;
  requestedAt: string;
  /** When they left the guild's Discord server; null while they're in it. */
  leftDiscordAt: string | null;
}

/** `POST /api/guilds/:guildId/registrations/:registrationId/approve`. */
export interface ApproveRegistrationResponse {
  /** The member on the roster, to add their characters. */
  memberId: string;
  /** True when a removed member was added back with their old record. */
  restored: boolean;
}

/** A Discord server member found by `GET /api/guilds/:guildId/discord-members?query=`. */
export interface DiscordMemberOption {
  id: string;
  name: string;
  avatarUrl: string;
  /** Already on this guild's roster, so they can't be added again. */
  onRoster: boolean;
}
