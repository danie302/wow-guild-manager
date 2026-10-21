import { z } from 'zod';

import { BASE_RANKS } from '../game.js';
import { characterSchema } from './character.js';
import { discordIdSchema } from './guild.js';

export const OFFICER_NOTE_MAX_LENGTH = 2000;

/** Error codes for roster checks, used as issue codes like the character ones. */
export const ROSTER_ERROR_CODES = {
  /** The Discord user isn't a member of the guild's Discord server. */
  notInServer: 'DISCORD_USER_NOT_IN_SERVER',
} as const;

/** Body of `POST /api/guilds/:guildId/members`: a Discord user and their characters. */
export const addMemberSchema = z
  .object({
    discordUserId: discordIdSchema,
    rank: z.enum(BASE_RANKS),
    characters: z.array(characterSchema).min(1),
  })
  .strict();

/** Body of `PATCH /api/guilds/:guildId/members/:memberId`: the Raider or Member rank. */
export const changeRankSchema = z.object({ rank: z.enum(BASE_RANKS) }).strict();

/** Body of `PUT /api/guilds/:guildId/members/:memberId/main`. */
export const setMainCharacterSchema = z.object({ characterId: z.uuid() }).strict();

/** Body of `POST /api/guilds/:guildId/members/:memberId/notes`. */
export const officerNoteSchema = z
  .object({ text: z.string().trim().min(1).max(OFFICER_NOTE_MAX_LENGTH) })
  .strict();

export type AddMemberInput = z.input<typeof addMemberSchema>;
export type ChangeRankInput = z.infer<typeof changeRankSchema>;
export type OfficerNoteInput = z.infer<typeof officerNoteSchema>;
