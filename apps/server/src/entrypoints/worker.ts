import { loadConfigOrExit, workerConfigSchema } from '../config.js';
import { createSequelize } from '../db/sequelize.js';
import { createCharacterLookup } from '../integrations/character-lookup/character-lookup.js';
import { createRestAppEmojis, postEmojiSource } from '../integrations/discord/app-emojis.js';
import { createRestChannelMessages } from '../integrations/discord/channel-messages.js';
import { createRestDirectMessenger } from '../integrations/discord/direct-messages.js';
import { createRestServerExit } from '../integrations/discord/server-exit.js';
import { createJobHandlers } from '../jobs/handlers/index.js';
import { createJobWorker, JobQueue, redisConnection } from '../jobs/index.js';
import { allUpcomingEventIds, scheduleEventJobs } from '../jobs/event-jobs.js';
import { createLogger } from '../logger.js';

const config = loadConfigOrExit(workerConfigSchema);
const logger = createLogger(config);

const sequelize = createSequelize(config.DATABASE_URL, logger);

if (!config.DISCORD_BOT_TOKEN) {
  logger.warn(
    'DISCORD_BOT_TOKEN is not set, so direct messages and event posts are off (see README)',
  );
}

// Jobs that add other jobs, and the recurring jobs below, use this queue.
const jobs = new JobQueue({ connection: redisConnection(config.REDIS_URL) });

const worker = createJobWorker({
  connection: redisConnection(config.REDIS_URL),
  handlers: createJobHandlers({
    logger,
    characterLookup: createCharacterLookup(),
    messenger: config.DISCORD_BOT_TOKEN
      ? createRestDirectMessenger(config.DISCORD_BOT_TOKEN)
      : null,
    channelMessages: config.DISCORD_BOT_TOKEN
      ? createRestChannelMessages(config.DISCORD_BOT_TOKEN)
      : null,
    jobs,
    serverExit: config.DISCORD_BOT_TOKEN ? createRestServerExit(config.DISCORD_BOT_TOKEN) : null,
    emojis: postEmojiSource(
      config.DISCORD_BOT_TOKEN ? createRestAppEmojis(config.DISCORD_BOT_TOKEN) : null,
      logger,
    ),
  }),
  logger,
});

await worker.waitUntilReady();

// Recurring jobs. Upserting on every start keeps their schedule in step with the code.
await jobs.repeat('extend-series', {}, { schedulerId: 'extend-series', pattern: '0 * * * *' });
// Also once now, so a series doesn't wait up to an hour after a restart.
await jobs.enqueue('extend-series', {});
// Every upcoming event's Tentative jobs, in case some were lost or the events predate them.
// Fixed job IDs make this safe to repeat.
await scheduleEventJobs(jobs, await allUpcomingEventIds());
logger.info('Worker ready');

process.on('SIGTERM', () => {
  logger.info('Shutting down');
  // Waits for running jobs to finish. A job cut off by a hard kill goes back to the queue.
  void worker
    .close()
    .then(() => Promise.all([jobs.close(), sequelize.close()]))
    .then(() => process.exit(0));
});
