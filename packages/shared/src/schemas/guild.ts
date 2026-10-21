import { z } from 'zod';

import { FACTIONS } from '../game.js';
import { hasOffensiveWords } from '../offensive-words.js';

export const GUILD_NAME_MAX_LENGTH = 50;

/** Error codes for the guild checks, used as issue messages like the character ones. */
export const GUILD_ERROR_CODES = {
  nameNotAllowed: 'NAME_NOT_ALLOWED',
  discordServerNotManageable: 'DISCORD_SERVER_NOT_MANAGEABLE',
  officerRoleNotFound: 'OFFICER_ROLE_NOT_FOUND',
} as const;

export const guildNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(GUILD_NAME_MAX_LENGTH)
  .refine((name) => !hasOffensiveWords(name), { message: GUILD_ERROR_CODES.nameNotAllowed });

/** A Discord ID (a "snowflake"): a 64-bit number, kept as text because it's too big for JS. */
export const discordIdSchema = z.string().regex(/^\d{17,20}$/);

/** The Discord server a guild is connected to, and the role that grants Officer there. */
export const guildDiscordSchema = z
  .object({
    discordServerId: discordIdSchema,
    officerRoleId: discordIdSchema,
  })
  .strict();

/** Body of `POST /api/guilds`: everything the setup collects, sent at its last step. */
export const createGuildSchema = z
  .object({
    name: guildNameSchema,
    faction: z.enum(FACTIONS),
    ...guildDiscordSchema.shape,
  })
  .strict();

export type CreateGuildInput = z.infer<typeof createGuildSchema>;
export type GuildDiscordInput = z.infer<typeof guildDiscordSchema>;
