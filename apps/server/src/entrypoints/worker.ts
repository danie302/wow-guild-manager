import { loadConfigOrExit, workerConfigSchema } from '../config.js';
import { createSequelize } from '../db/sequelize.js';
import { createCharacterLookup } from '../integrations/character-lookup/character-lookup.js';
import { createRestDirectMessenger } from '../integrations/discord/direct-messages.js';
import { createJobHandlers } from '../jobs/handlers/index.js';
import { createJobWorker, redisConnection } from '../jobs/index.js';
import { createLogger } from '../logger.js';

const config = loadConfigOrExit(workerConfigSchema);
const logger = createLogger(config);

const sequelize = createSequelize(config.DATABASE_URL, logger);

if (!config.DISCORD_BOT_TOKEN) {
  logger.warn('DISCORD_BOT_TOKEN is not set, so direct messages are off (see README)');
}

const worker = createJobWorker({
  connection: redisConnection(config.REDIS_URL),
  handlers: createJobHandlers({
    logger,
    characterLookup: createCharacterLookup(),
    messenger: config.DISCORD_BOT_TOKEN
      ? createRestDirectMessenger(config.DISCORD_BOT_TOKEN)
      : null,
  }),
  logger,
});

await worker.waitUntilReady();
logger.info('Worker ready');

process.on('SIGTERM', () => {
  logger.info('Shutting down');
  // Waits for running jobs to finish. A job cut off by a hard kill goes back to the queue.
  void worker
    .close()
    .then(() => sequelize.close())
    .then(() => process.exit(0));
});
