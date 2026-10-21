import { baseConfigSchema, loadConfigOrExit } from '../config.js';
import { createCharacterLookup } from '../integrations/character-lookup/character-lookup.js';
import { createJobHandlers } from '../jobs/handlers/index.js';
import { createJobWorker, redisConnection } from '../jobs/index.js';
import { createLogger } from '../logger.js';

const config = loadConfigOrExit(baseConfigSchema);
const logger = createLogger(config);

const worker = createJobWorker({
  connection: redisConnection(config.REDIS_URL),
  handlers: createJobHandlers({ logger, characterLookup: createCharacterLookup() }),
  logger,
});

await worker.waitUntilReady();
logger.info('Worker ready');

process.on('SIGTERM', () => {
  logger.info('Shutting down');
  // Waits for running jobs to finish. A job cut off by a hard kill goes back to the queue.
  void worker.close().then(() => process.exit(0));
});
