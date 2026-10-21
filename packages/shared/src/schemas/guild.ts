import { z } from 'zod';

import { FACTIONS } from '../game.js';
import { SUPPORTED_LOCALES } from '../locales.js';
import { hasOffensiveWords } from '../offensive-words.js';

export const GUILD_NAME_MAX_LENGTH = 50;

/** Error codes for the guild checks, used as issue messages like the character ones. */
export const GUILD_ERROR_CODES = {
  nameNotAllowed: 'NAME_NOT_ALLOWED',
  discordServerNotManageable: 'DISCORD_SERVER_NOT_MANAGEABLE',
  officerRoleNotFound: 'OFFICER_ROLE_NOT_FOUND',
  /** The bot can't see, write, or post embeds in the channel, or it isn't a text channel. */
  eventsChannelNotUsable: 'EVENTS_CHANNEL_NOT_USABLE',
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

/**
 * Fields of `PATCH /api/guilds/:guildId`, the guild settings page's single save. It's sent as
 * multipart/form-data with an optional `image` file, so every value is text. Only the fields
 * that changed are sent; they're all saved together or not at all.
 */
export const updateGuildSchema = z
  .object({
    name: guildNameSchema,
    discordServerId: discordIdSchema,
    officerRoleId: discordIdSchema,
    /** The channel where the bot posts events. A new server needs its own channel. */
    eventsChannelId: discordIdSchema,
    /** The language of the guild's public Discord messages. */
    discordLocale: z.enum(SUPPORTED_LOCALES),
    /** "true" removes the guild image. */
    removeImage: z.literal('true'),
  })
  .partial()
  .strict()
  // A role belongs to one server, so a new server needs its Officer role too.
  .refine((input) => input.discordServerId === undefined || input.officerRoleId !== undefined, {
    path: ['officerRoleId'],
    message: 'REQUIRED',
  });

export type UpdateGuildInput = z.infer<typeof updateGuildSchema>;

/** Image types the guild image can be uploaded as, and the largest upload. */
export const GUILD_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const GUILD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type CreateGuildInput = z.infer<typeof createGuildSchema>;
export type GuildDiscordInput = z.infer<typeof guildDiscordSchema>;
