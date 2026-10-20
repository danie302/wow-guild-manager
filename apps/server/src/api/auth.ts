import { randomBytes, timingSafeEqual } from 'node:crypto';

import {
  DEFAULT_TIME_ZONE,
  isLocale,
  isValidTimeZone,
  normalizeTimeZone,
  type LoginError,
} from '@wgm/shared';
import express, { type Request, type Response } from 'express';

import type { DiscordOAuth } from '../auth/discord-oauth.js';
import { upsertUserFromDiscord } from '../auth/users.js';
import { SESSION_COOKIE } from './session.js';

/**
 * The Discord login. The web app links to `/api/auth/discord/login`; Discord sends the user back
 * to `/api/auth/discord/callback`, which logs them in and redirects to the web app.
 * `oauth` is null when the Discord application credentials aren't configured.
 */
export function authRouter(oauth: DiscordOAuth | null) {
  const router = express.Router();

  router.get('/auth/discord/login', (req, res, next) => {
    if (!oauth) {
      redirectToLogin(res, 'not_configured');
      return;
    }
    const state = randomBytes(32).toString('base64url');
    req.session.oauthState = state;
    const locale = req.query.locale;
    req.session.loginLocale = isLocale(locale) ? locale : 'en';
    const timeZone = req.query.timeZone;
    req.session.loginTimeZone =
      typeof timeZone === 'string' && isValidTimeZone(timeZone)
        ? normalizeTimeZone(timeZone)
        : DEFAULT_TIME_ZONE;
    req.session.save((err) => {
      if (err) {
        next(err);
        return;
      }
      res.redirect(oauth.authorizeUrl(state));
    });
  });

  router.get('/auth/discord/callback', async (req, res) => {
    const expectedState = req.session.oauthState;
    delete req.session.oauthState;

    if (!oauth) {
      redirectToLogin(res, 'not_configured');
      return;
    }
    if (!sameState(req.query.state, expectedState)) {
      req.log.warn('Login rejected: missing or wrong OAuth2 state');
      redirectToLogin(res, 'failed');
      return;
    }
    if (req.query.error === 'access_denied') {
      redirectToLogin(res, 'cancelled');
      return;
    }
    const code = req.query.code;
    if (typeof code !== 'string' || code === '') {
      redirectToLogin(res, 'failed');
      return;
    }

    try {
      const profile = await oauth.fetchProfile(code);
      const user = await upsertUserFromDiscord(profile, {
        locale: req.session.loginLocale ?? 'en',
        timeZone: req.session.loginTimeZone ?? DEFAULT_TIME_ZONE,
      });
      await logIn(req, user.id);
      req.log.info({ userId: user.id }, 'User logged in');
      res.redirect('/');
    } catch (err) {
      req.log.error({ err }, 'Discord login failed');
      redirectToLogin(res, 'failed');
    }
  });

  router.post('/auth/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) {
        next(err);
        return;
      }
      res.clearCookie(SESSION_COOKIE);
      res.status(204).end();
    });
  });

  return router;
}

function redirectToLogin(res: Response, error: LoginError) {
  res.redirect(`/login?error=${error}`);
}

function sameState(received: unknown, expected: string | undefined): boolean {
  if (typeof received !== 'string' || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Starts a fresh session for the user, so a session ID set before login can't be reused. */
function logIn(req: Request, userId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        reject(regenerateError as Error);
        return;
      }
      req.session.userId = userId;
      req.session.save((saveError) => (saveError ? reject(saveError as Error) : resolve()));
    });
  });
}
