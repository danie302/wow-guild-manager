import type { Locale } from '@wgm/shared';
import session, { type Store } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    /** The logged-in app user. */
    userId?: number;
    /** The OAuth2 `state` sent to Discord, checked on the callback. */
    oauthState?: string;
    /** The web app's language when the login started, for a user created by this login. */
    loginLocale?: Locale;
    /** The browser's time zone when the login started, for a user created by this login. */
    loginTimeZone?: string;
  }
}

export const SESSION_COOKIE = 'wgm.sid';

/** Sessions last 30 days and every request restarts the countdown. */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionOptions {
  store: Store;
  secret: string;
  /** Send the cookie only over HTTPS. True outside development and tests. */
  secure: boolean;
}

export function sessionMiddleware({ store, secret, secure }: SessionOptions) {
  return session({
    name: SESSION_COOKIE,
    store,
    secret,
    resave: false,
    // No session (and no cookie) until there's something to keep, like a login in progress.
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure, maxAge: SESSION_MAX_AGE_MS },
  });
}
