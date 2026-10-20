/** The web app's color themes. Dark is the default. */
export const THEMES = ['dark', 'light'] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'dark';

/** Used when no valid time zone is known, e.g. a login from a browser that doesn't report one. */
export const DEFAULT_TIME_ZONE = 'UTC';

/** True for an IANA time zone name the runtime knows, e.g. "America/Bogota". */
export function isValidTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/** The runtime's spelling of a valid time zone name (e.g. "utc" becomes "UTC"). */
export function normalizeTimeZone(name: string): string {
  return new Intl.DateTimeFormat('en', { timeZone: name }).resolvedOptions().timeZone;
}
