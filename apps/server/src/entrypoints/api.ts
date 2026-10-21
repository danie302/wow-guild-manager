import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

import { createApp } from '../api/app.js';
import { databaseCheck, redisCheck } from '../api/health.js';
import { createDiscordOAuth } from '../auth/discord-oauth.js';
import { apiConfigSchema, loadConfigOrExit } from '../config.js';
import { createSequelize } from '../db/sequelize.js';
import { JobQueue, redisConnection } from '../jobs/index.js';
import { cachedDiscordDirectory } from '../integrations/discord/cached-directory.js';
import { createRestAppEmojis, postEmojiSource } from '../integrations/discord/app-emojis.js';
import { botInviteUrl } from '../integrations/discord/invite.js';
import { createRestDiscordDirectory } from '../integrations/discord/rest-directory.js';
import { createLogger } from '../logger.js';
import { localFileStorage } from '../storage/file-storage.js';

// Migrations run before this process starts (see the api command in docker-compose.yml), never from bot or worker.

const config = loadConfigOrExit(apiConfigSchema);
const logger = createLogger(config);

const sequelize = createSequelize(config.DATABASE_URL, logger);

// Without the offline queue, commands fail right away while Redis is down instead of waiting.
const redis = createClient({ url: config.REDIS_URL, disableOfflineQueue: true });
redis.on('error', (err: unknown) => logger.warn({ err }, 'Redis client error'));
await redis.connect();

// Routes add background jobs through this queue; the worker container runs them.
const jobs = new JobQueue({ connection: redisConnection(config.REDIS_URL) });

const oauth =
  config.DISCORD_CLIENT_ID && config.DISCORD_CLIENT_SECRET
    ? createDiscordOAuth({
        clientId: config.DISCORD_CLIENT_ID,
        clientSecret: config.DISCORD_CLIENT_SECRET,
        redirectUri: new URL('/api/auth/discord/callback', config.WEB_ORIGIN).toString(),
      })
    : null;
if (!oauth) {
  logger.warn(
    'DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET is not set, so login is off (see README)',
  );
}

// The guild setup reads Discord with the bot token, and the bot invite needs the client ID.
const discord =
  config.DISCORD_BOT_TOKEN && config.DISCORD_CLIENT_ID
    ? {
        directory: cachedDiscordDirectory(createRestDiscordDirectory(config.DISCORD_BOT_TOKEN), {
          redis,
        }),
        botInviteUrl: botInviteUrl(config.DISCORD_CLIENT_ID),
        // A bot's user ID is its application's client ID.
        botUserId: config.DISCORD_CLIENT_ID,
        emojis: postEmojiSource(createRestAppEmojis(config.DISCORD_BOT_TOKEN), logger),
      }
    : null;
if (!discord) {
  logger.warn(
    'DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID is not set, so guild setup is off (see README)',
  );
}

const production = config.NODE_ENV === 'production';
const app = createApp({
  logger,
  healthChecks: { database: databaseCheck(sequelize), redis: redisCheck(redis) },
  auth: {
    store: new RedisStore({ client: redis, prefix: 'session:' }),
    secret: config.SESSION_SECRET,
    secure: production,
    oauth,
  },
  discord,
  storage: localFileStorage(config.UPLOADS_DIR),
  jobs,
  trustProxy: production,
});

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'API listening');
});

process.on('SIGTERM', () => {
  logger.info('Shutting down');
  server.close(() => {
    void Promise.allSettled([sequelize.close(), redis.close(), jobs.close()]).then(() =>
      process.exit(0),
    );
  });
});
