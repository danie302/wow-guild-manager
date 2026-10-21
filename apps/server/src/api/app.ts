import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';

import type { DiscordOAuth } from '../auth/discord-oauth.js';
import type { Logger } from '../logger.js';
import { authRouter } from './auth.js';
import { discordRouter, type DiscordAccess } from './discord.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { guildsRouter } from './guilds.js';
import { healthRouter, type HealthChecks } from './health.js';
import { meRouter } from './me.js';
import { sessionMiddleware, type SessionOptions } from './session.js';

export interface AppDependencies {
  logger: Logger;
  healthChecks: HealthChecks;
  /** Sessions and the Discord login. Tests that don't need them can leave this out. */
  auth?: SessionOptions & { oauth: DiscordOAuth | null };
  /** Reading Discord with the bot token. Null (or left out) when it isn't set up. */
  discord?: DiscordAccess | null;
  /** Set behind a reverse proxy that terminates HTTPS, so secure cookies work. */
  trustProxy?: boolean;
}

/** Builds the Express app without listening, so tests can use it with Supertest. */
export function createApp({
  logger,
  healthChecks,
  auth,
  discord = null,
  trustProxy,
}: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(pinoHttp({ logger }));
  app.use(express.json());

  const api = express.Router();
  api.use(healthRouter(healthChecks));
  if (auth) {
    api.use(sessionMiddleware(auth));
    api.use(authRouter(auth.oauth));
    api.use(meRouter());
    api.use(discordRouter(discord));
    api.use(guildsRouter(discord));
  }
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
