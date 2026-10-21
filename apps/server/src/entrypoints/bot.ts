import { createClient } from 'redis';

import { watchDiscordChanges } from '../bot/cache-events.js';
import { createBotClient, describeLoginError } from '../bot/client.js';
import { syncMemberProfiles } from '../bot/member-profiles.js';
import { syncOfficers } from '../bot/officer-sync.js';
import { createCommands } from '../bot/commands/index.js';
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

// Commands add background jobs (e.g. looking up a registered character) through this queue.
const jobs = new JobQueue({ connection: redisConnection(config.REDIS_URL) });

const client = createBotClient({ logger, commands: createCommands({ jobs }) });
watchDiscordChanges(client, discordCacheInvalidator({ redis }), logger);
syncOfficers(client, logger);
syncMemberProfiles(client, logger);

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
