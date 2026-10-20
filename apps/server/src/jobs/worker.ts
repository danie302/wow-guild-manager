import { UnrecoverableError, Worker, type ConnectionOptions, type Job } from 'bullmq';

import type { Logger } from '../logger.js';
import type { JobName, JobPayloads } from './definitions.js';
import { QUEUE_NAME } from './queue.js';

/** One handler per job name. A missing handler is a type error. */
export type JobHandlers = {
  [Name in JobName]: (data: JobPayloads[Name], job: Job) => Promise<void> | void;
};

export interface JobWorkerOptions {
  connection: ConnectionOptions;
  handlers: JobHandlers;
  logger: Logger;
  queueName?: string;
  /** How many jobs run at the same time. */
  concurrency?: number;
}

/**
 * Runs the jobs in the queue. A handler that throws is retried with backoff; throw
 * UnrecoverableError to fail at once without retrying.
 */
export function createJobWorker({
  connection,
  handlers,
  logger,
  queueName = QUEUE_NAME,
  concurrency = 5,
}: JobWorkerOptions): Worker {
  const worker = new Worker(
    queueName,
    async (job: Job) => {
      if (!Object.hasOwn(handlers, job.name)) {
        throw new UnrecoverableError(`No handler for job "${job.name}"`);
      }
      const handler = handlers[job.name as JobName] as (
        data: unknown,
        job: Job,
      ) => Promise<void> | void;
      await handler(job.data, job);
    },
    { connection, concurrency },
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, job: job.name }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    if (!job) {
      logger.error({ err }, 'Job failed');
      return;
    }
    const attempts = job.opts.attempts ?? 1;
    const context = { err, jobId: job.id, job: job.name, attempt: job.attemptsMade, attempts };
    if (job.attemptsMade < attempts && !(err instanceof UnrecoverableError)) {
      logger.warn(context, 'Job attempt failed, will retry');
    } else {
      logger.error(context, 'Job failed');
    }
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Job worker error');
  });

  return worker;
}
