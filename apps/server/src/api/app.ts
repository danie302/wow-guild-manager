import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';

import type { Logger } from '../logger.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { healthRouter, type HealthChecks } from './health.js';

export interface AppDependencies {
  logger: Logger;
  healthChecks: HealthChecks;
}

/** Builds the Express app without listening, so tests can use it with Supertest. */
export function createApp({ logger, healthChecks }: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(pinoHttp({ logger }));
  app.use(express.json());

  const api = express.Router();
  api.use(healthRouter(healthChecks));
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
