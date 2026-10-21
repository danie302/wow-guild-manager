import { createClient } from 'redis';

import { watchDiscordChanges } from '../bot/cache-events.js';
import { createBotClient, describeLoginError } from '../bot/client.js';
import { syncMemberProfiles } from '../bot/member-profiles.js';
import { retryFailedPosts } from '../bot/post-retries.js';
import { signUpHandler } from '../bot/sign-up.js';
import { syncServerMembers } from '../bot/server-sync.js';
import { commands } from '../bot/commands/index.js';
import { botConfigSchema, loadConfigOrExit } from '../config.js';
import { createSequelize } from '../db/sequelize.js';
import { discordCacheInvalidator } from '../integrations/discord/cached-directory.js';
import { JobQueue, redisConnection } from '../jobs/index.js';
import { createLogger } from '../logger.js';

const config = loadConfigOrExit(botConfigSchema);
const logger = createLogger(config);

// Keeps the Officers table in step with Discord.
const sequelize = createSequelize(config.DATABASE_URL, logger);

// Clears the API's cached Discord data when roles or members change.
const redis = createClient({ url: config.REDIS_URL, disableOfflineQueue: true });
redis.on('error', (err: unknown) => logger.warn({ err }, 'Redis client error'));
await redis.connect();

// Post updates after sign-ups, and retries of failed posts, go to the worker through the queue.
const jobs = new JobQueue({ connection: redisConnection(config.REDIS_URL) });

const client = createBotClient({ logger, commands, components: [signUpHandler(jobs)] });
watchDiscordChanges(client, discordCacheInvalidator({ redis }), logger);
syncServerMembers(client, logger);
syncMemberProfiles(client, logger);
retryFailedPosts(client, jobs, logger);

process.on('SIGTERM', () => {
  logger.info('Disconnecting from Discord');
  void Promise.allSettled([client.destroy(), redis.close(), jobs.close(), sequelize.close()]).then(
    () => process.exit(0),
  );
});

try {
  await client.login(config.DISCORD_BOT_TOKEN);
} catch (err) {
  logger.fatal({ err }, describeLoginError(err));
  process.exit(1);
}
