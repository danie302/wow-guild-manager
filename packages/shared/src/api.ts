import { z } from 'zod';

import { SUPPORTED_LOCALES, type Locale } from './locales.js';
import { isValidTimeZone, normalizeTimeZone, THEMES, type Theme } from './preferences.js';
import type {
  BaseRank,
  CharacterClass,
  CombatRole,
  Faction,
  Profession,
  Race,
  Rank,
} from './game.js';
import { CHARACTER_ERROR_CODES } from './schemas/character.js';
import {
  EVENT_ERROR_CODES,
  type AttendanceBand,
  type AttendancePeriod,
  type AttendanceRate,
  type AttendanceStatus,
  type EventType,
  type SignUpPlacement,
  type SignUpStatus,
} from './schemas/event.js';
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
  ...Object.values(EVENT_ERROR_CODES),
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
        | 'REGISTRATION_NOT_PENDING'
        // The event has started, so it can't be edited or cancelled any more.
        | 'EVENT_STARTED'
        // The event was cancelled, so it can't be edited or cancelled again.
        | 'EVENT_CANCELLED'
        // The recurring series was stopped, so it can't be edited or stopped again.
        | 'SERIES_STOPPED'
        // Only Tentative participants can be replaced.
        | 'SIGN_UP_NOT_TENTATIVE'
        // The replacement isn't on the waitlist of that role (anymore).
        | 'NOT_ON_WAITLIST'
        // Attendance opens when the event starts.
        | 'ATTENDANCE_NOT_OPEN';
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

/** `GET /api/guilds/:guildId/transfer-candidates`: who can become Guild Master. */
export interface TransferCandidate {
  memberId: string;
  discordName: string;
  /** The guild they already lead, if any: they can't take this one too. */
  leads: string | null;
}

/** `GET /api/discord/servers/:serverId/roles`: roles that can grant Officer, highest first. */
export interface DiscordRolesResponse {
  roles: DiscordRoleOption[];
}

export interface DiscordChannelOption {
  id: string;
  name: string;
  /** The category it's in, or null when it's in none. */
  category: string | null;
}

/**
 * `GET /api/discord/servers/:serverId/channels`: text channels where the bot can see, write,
 * and post embeds, in Discord's order.
 */
export interface DiscordChannelsResponse {
  channels: DiscordChannelOption[];
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
  /** Where the bot posts events; null until the Guild Master chooses one. */
  eventsChannel: { id: string; name: string | null } | null;
  /** The language of the guild's public Discord messages. */
  discordLocale: Locale;
  /** Hours before an event that Tentative participants must confirm. */
  tentativeDeadlineHours: number;
  /** Hours before that deadline the reminder is sent. */
  reminderHours: number;
  /** Attendance bands in percent: Good at or above `good`, At risk below `atRisk`. */
  attendanceThresholds: { good: number; atRisk: number };
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
  /** Their attendance rate over the last 8 weeks; null without records. */
  attendanceRate: number | null;
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

/** An event on `GET /api/guilds/:guildId/events` and its own page. Times are UTC ISO strings. */
export interface EventResponse {
  id: string;
  type: EventType;
  name: string;
  description: string;
  startsAt: string;
  size: number;
  slots: { tank: number; healer: number; dps: number };
  /** Null when the creator's account no longer exists. */
  createdBy: string | null;
  /** Set once the event is cancelled; `by` is null when that account no longer exists. */
  cancelled: { at: string; by: string | null } | null;
  /** The weekly series it belongs to, if any. */
  series: { id: string; name: string } | null;
  /**
   * When Tentative sign-ups close, how many hours before the start that is, and whether it's
   * the event's own deadline (`own`) or the guild's.
   */
  tentativeDeadline: { at: string; hours: number; own: boolean };
  /**
   * Its Discord post: `url` is null until the bot posts it, and `error` says why the last
   * attempt failed, if it did.
   */
  discordPost: { url: string | null; error: DiscordPostError | null };
}

/**
 * A sign-up on `GET /api/guilds/:guildId/events/:eventId/sign-ups`, in sign-up order. `role`
 * is null only for a Declined sign-up that never had one; `placement` is null when Declined.
 */
export interface SignUpResponse {
  id: string;
  character: { id: string; name: string; class: CharacterClass; race: Race };
  role: CombatRole | null;
  status: SignUpStatus;
  placement: SignUpPlacement | null;
  signedUpAt: string;
}

/** `GET /api/guilds/:guildId/series/:seriesId/sign-ups`: each future event's sign-ups. */
export interface SeriesSignUpsResponse {
  events: { id: string; startsAt: string; signUps: SignUpResponse[] }[];
}

/** One member on an event's attendance list. */
export interface AttendanceRecordResponse {
  memberId: string;
  discordName: string;
  character: { id: string; name: string; class: CharacterClass; race: Race };
  /** Their sign-up's role; null for a Declined sign-up or a member added to the list. */
  role: CombatRole | null;
  /** False for a member added to the list who didn't sign up. */
  signedUp: boolean;
  status: AttendanceStatus;
}

/** A correction after attendance was first saved; `from` is null when a member was added. */
export interface AttendanceChangeResponse {
  id: string;
  memberId: string;
  character: { name: string; class: CharacterClass };
  from: AttendanceStatus | null;
  to: AttendanceStatus;
  /** Null when that account no longer exists. */
  by: string | null;
  at: string;
}

/**
 * `GET /api/guilds/:guildId/events/:eventId/attendance`. Before the first save, `records` is
 * the draft pre-filled from the sign-ups and `recorded` is null.
 */
export interface AttendanceResponse {
  /** Attendance opens when the event starts; a cancelled event has none. */
  open: boolean;
  recorded: { at: string; by: string | null } | null;
  records: AttendanceRecordResponse[];
  /** Newest first. */
  history: AttendanceChangeResponse[];
}

/**
 * `GET /api/guilds/:guildId/members/:memberId/attendance?period=`: a member's attendance rate,
 * overall and per event type, their late arrivals and no-shows, and their history, newest
 * first.
 */
export interface MemberAttendanceResponse {
  period: AttendancePeriod;
  overall: AttendanceRate & { band: AttendanceBand | null };
  byType: Record<EventType, AttendanceRate>;
  late: number;
  noShow: number;
  history: {
    eventId: string;
    name: string;
    type: EventType;
    startsAt: string;
    character: { name: string; class: CharacterClass };
    status: AttendanceStatus;
  }[];
}

/** One member on the attendance report. */
export interface AttendanceReportRow extends AttendanceRate {
  memberId: string;
  discordName: string;
  rank: Rank;
  /** Null when they have no active character. */
  main: { name: string; class: CharacterClass } | null;
  late: number;
  noShow: number;
  band: AttendanceBand | null;
}

/**
 * `GET /api/guilds/:guildId/attendance?period=&type=`: every member on the roster with their
 * attendance in the period (and event type), the guild average, and how many are in each band.
 */
export interface AttendanceReportResponse {
  period: AttendancePeriod;
  type: EventType | 'all';
  thresholds: { good: number; atRisk: number };
  /** The average of the members' rates; null when nobody has records. */
  average: number | null;
  bands: Record<AttendanceBand, number>;
  members: AttendanceReportRow[];
}

/**
 * `GET /api/guilds/:guildId/dashboard`: what needs the Guild Master's and Officers' attention.
 * Times are UTC ISO strings.
 */
export interface DashboardResponse {
  /** The next few events, with how full each role is. */
  upcoming: {
    id: string;
    type: EventType;
    name: string;
    startsAt: string;
    size: number;
    cancelled: boolean;
    slots: Record<CombatRole, number>;
    filled: Record<CombatRole, number>;
  }[];
  /** Events in the next 8 days with open slots, and how many each role is missing. */
  missingRoles: {
    id: string;
    name: string;
    startsAt: string;
    size: number;
    missing: Record<CombatRole, number>;
  }[];
  /** Tentative participants whose event's deadline is within 48 hours. */
  tentative: {
    signUpId: string;
    eventId: string;
    eventName: string;
    startsAt: string;
    deadlineAt: string;
    character: { name: string; class: CharacterClass };
    role: CombatRole;
  }[];
  /** Pending requests to join. */
  registrations: { id: string; discordName: string; requestedAt: string }[];
  /** Members flagged as having left the guild's Discord server. */
  leftDiscord: {
    memberId: string;
    discordName: string;
    rank: Rank;
    main: { name: string; class: CharacterClass } | null;
    leftAt: string;
  }[];
}

/** Why the bot couldn't post or update an event's Discord post. */
export const DISCORD_POST_ERRORS = ['missing_permissions', 'channel_not_found'] as const;

export type DiscordPostError = (typeof DISCORD_POST_ERRORS)[number];

/**
 * A Discord embed, as the bot sends it. Text may use Discord markdown (`**bold**`,
 * `~~struck~~`) and timestamps (`<t:1700000000:F>`), which Discord shows in each reader's
 * time zone.
 */
export interface DiscordEmbed {
  title: string;
  description?: string;
  /** RGB as a number. */
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
}

/**
 * `GET /api/guilds/:guildId/events/:eventId/discord-post`: the message the bot posts for the
 * event, built by the same code the bot uses, so the preview matches it.
 */
export interface EventDiscordPostResponse {
  /** Null until the Guild Master chooses an events channel. */
  channel: { id: string; name: string | null } | null;
  locale: Locale;
  embed: DiscordEmbed;
  /** The buttons under the post (none once the event is cancelled). */
  buttons: { label: string; style: 'primary' | 'secondary' }[];
}

/**
 * A weekly series on `GET /api/guilds/:guildId/series` and its own page. Its events follow
 * `startsAt` every 7 days at the same UTC time.
 */
export interface SeriesResponse {
  id: string;
  type: EventType;
  name: string;
  description: string;
  /** Its first event, or after an edit, the next one. */
  startsAt: string;
  size: number;
  slots: { tank: number; healer: number; dps: number };
  /** Its next event that isn't cancelled; null when there's none. */
  nextEventAt: string | null;
  /** That event, once it's created (two weeks ahead); null before. */
  nextEventId: string | null;
  /** Its events' own Tentative deadline in hours; null uses the guild's. */
  tentativeDeadlineHours: number | null;
  createdBy: string | null;
  /** Set once the series is stopped. */
  stopped: { at: string; by: string | null } | null;
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
