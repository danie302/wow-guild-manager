import pg from 'pg';
import { createClient } from 'redis';

import { createApp } from '../api/app.js';
import { postgresCheck, redisCheck } from '../api/health.js';
import { loadConfigOrExit } from '../config.js';
import { createLogger } from '../logger.js';

const config = loadConfigOrExit();
const logger = createLogger(config);

const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
pool.on('error', (err) => logger.error({ err }, 'PostgreSQL pool error'));

// Without the offline queue, commands fail right away while Redis is down instead of waiting.
const redis = createClient({ url: config.REDIS_URL, disableOfflineQueue: true });
redis.on('error', (err: unknown) => logger.warn({ err }, 'Redis client error'));
await redis.connect();

const app = createApp({
  logger,
  healthChecks: { database: postgresCheck(pool), redis: redisCheck(redis) },
});

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'API listening');
});

process.on('SIGTERM', () => {
  logger.info('Shutting down');
  server.close(() => {
    void Promise.allSettled([pool.end(), redis.close()]).then(() => process.exit(0));
  });
});
