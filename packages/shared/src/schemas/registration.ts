import { z } from 'zod';

import { CLASSES, MAX_LEVEL, MIN_LEVEL, PROFESSIONS, RACES } from '../game.js';

export const REGISTRATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/**
 * What the Battle.net lookup of a registered character found. `pending` until the worker has
 * looked it up; `unavailable` when there's no Battle.net client or it failed.
 */
export const REGISTRATION_LOOKUPS = ['pending', 'found', 'not_found', 'unavailable'] as const;
export type RegistrationLookup = (typeof REGISTRATION_LOOKUPS)[number];

/**
 * Body of `POST /api/guilds/:guildId/registrations/:registrationId/approve`. Race, class, and
 * level are needed when the lookup didn't find the character, and ignored when it did. The
 * faction is always the guild's.
 */
export const approveRegistrationSchema = z
  .object({
    race: z.enum(RACES).optional(),
    class: z.enum(CLASSES).optional(),
    level: z.number().int().min(MIN_LEVEL).max(MAX_LEVEL).optional(),
    professions: z.array(z.enum(PROFESSIONS)).default([]),
  })
  .strict();

export type ApproveRegistrationInput = z.input<typeof approveRegistrationSchema>;
