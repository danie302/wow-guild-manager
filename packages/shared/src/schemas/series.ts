import { z } from 'zod';

import type { CreateEventInput, UpdateEventInput } from './event.js';
import { discordIdSchema } from './guild.js';

/**
 * The series-only part of `POST /api/guilds/:guildId/series` and `PUT …/series/:seriesId`,
 * next to the event fields: the Discord channel its events are posted in. Null (or left out)
 * uses its type's channel or the guild's events channel.
 */
export const seriesChannelSchema = z
  .object({ channelId: discordIdSchema.nullable().default(null) })
  .strict();

export type CreateSeriesInput = CreateEventInput & { channelId?: string | null };
export type UpdateSeriesInput = UpdateEventInput & { channelId?: string | null };
