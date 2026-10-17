import { createClient } from 'redis';

import { createApp } from '../api/app.js';
import { databaseCheck, redisCheck } from '../api/health.js';
import { apiConfigSchema, loadConfigOrExit } from '../config.js';
import { createSequelize } from '../db/sequelize.js';
import { createLogger } from '../logger.js';

// Migrations run before this process starts (see the api command in docker-compose.yml), never from bot or worker.

const config = loadConfigOrExit(apiConfigSchema);
const logger = createLogger(config);

const sequelize = createSequelize(config.DATABASE_URL, logger);

// Without the offline queue, commands fail right away while Redis is down instead of waiting.
const redis = createClient({ url: config.REDIS_URL, disableOfflineQueue: true });
redis.on('error', (err: unknown) => logger.warn({ err }, 'Redis client error'));
await redis.connect();

const app = createApp({
  logger,
  healthChecks: { database: databaseCheck(sequelize), redis: redisCheck(redis) },
});

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'API listening');
});

process.on('SIGTERM', () => {
  logger.info('Shutting down');
  server.close(() => {
    void Promise.allSettled([sequelize.close(), redis.close()]).then(() => process.exit(0));
  });
});
