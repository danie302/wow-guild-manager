import { z } from 'zod';

import { SUPPORTED_LOCALES, type Locale } from './locales.js';
import { isValidTimeZone, normalizeTimeZone, THEMES, type Theme } from './preferences.js';
import { CHARACTER_ERROR_CODES } from './schemas/character.js';

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
  | { code: 'NOT_FOUND' | 'INVALID_JSON' | 'INTERNAL_ERROR' | 'UNAUTHENTICATED' }
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

/** The logged-in app user, from `GET /api/me`. */
export interface MeResponse {
  id: number;
  discordId: string;
  name: string;
  avatarUrl: string;
  locale: Locale;
  /** IANA time zone name. Every date in the web app is shown in it. */
  timeZone: string;
  theme: Theme;
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
