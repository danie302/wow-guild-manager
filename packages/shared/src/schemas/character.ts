import { z } from 'zod';

import {
  CLASSES,
  classesFor,
  COMBAT_ROLES,
  FACTIONS,
  isPrimaryProfession,
  MAX_LEVEL,
  MAX_PRIMARY_PROFESSIONS,
  MIN_LEVEL,
  PROFESSIONS,
  RACES,
  racesFor,
  rolesFor,
} from '../game.js';

/**
 * Error codes for the game-rule checks. They're the issue messages, so the API can return them
 * as codes and the web client can translate them.
 */
export const CHARACTER_ERROR_CODES = {
  raceNotInFaction: 'RACE_NOT_IN_FACTION',
  classNotForRace: 'CLASS_NOT_FOR_RACE',
  duplicateProfession: 'DUPLICATE_PROFESSION',
  tooManyPrimaryProfessions: 'TOO_MANY_PRIMARY_PROFESSIONS',
  classCannotFillRole: 'CLASS_CANNOT_FILL_ROLE',
  /** Another active character already has this name (names are unique across the game). */
  nameTaken: 'CHARACTER_NAME_TAKEN',
  /** The character's faction differs from the guild's. */
  wrongFaction: 'CHARACTER_WRONG_FACTION',
} as const;

/** Character names are stored with at most this many characters. */
export const CHARACTER_NAME_MAX_LENGTH = 64;

/** Any non-empty name: the Battle.net lookup is what confirms a character exists. */
export const characterNameSchema = z.string().trim().min(1).max(CHARACTER_NAME_MAX_LENGTH);

/** A character as entered by hand or filled in from Battle.net. Professions are optional. */
export const characterSchema = z
  .object({
    name: characterNameSchema,
    faction: z.enum(FACTIONS),
    race: z.enum(RACES),
    class: z.enum(CLASSES),
    level: z.number().int().min(MIN_LEVEL).max(MAX_LEVEL),
    professions: z.array(z.enum(PROFESSIONS)),
  })
  .superRefine((character, ctx) => {
    if (!racesFor(character.faction).includes(character.race)) {
      ctx.addIssue({
        code: 'custom',
        path: ['race'],
        message: CHARACTER_ERROR_CODES.raceNotInFaction,
      });
    } else if (!classesFor(character.faction, character.race).includes(character.class)) {
      ctx.addIssue({
        code: 'custom',
        path: ['class'],
        message: CHARACTER_ERROR_CODES.classNotForRace,
      });
    }

    if (new Set(character.professions).size !== character.professions.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['professions'],
        message: CHARACTER_ERROR_CODES.duplicateProfession,
      });
    }
    if (character.professions.filter(isPrimaryProfession).length > MAX_PRIMARY_PROFESSIONS) {
      ctx.addIssue({
        code: 'custom',
        path: ['professions'],
        message: CHARACTER_ERROR_CODES.tooManyPrimaryProfessions,
        params: { count: MAX_PRIMARY_PROFESSIONS },
      });
    }
  });

export type CharacterInput = z.input<typeof characterSchema>;
export type Character = z.output<typeof characterSchema>;

/**
 * A class with the combat role it signs up as. Characters don't have a role of their own:
 * they pick one on every sign-up, and it must be one their class can fill.
 */
export const classRoleSchema = z
  .object({
    class: z.enum(CLASSES),
    role: z.enum(COMBAT_ROLES),
  })
  .refine((value) => rolesFor(value.class).includes(value.role), {
    path: ['role'],
    message: CHARACTER_ERROR_CODES.classCannotFillRole,
  });
