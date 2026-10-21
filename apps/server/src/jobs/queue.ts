import { Queue, type ConnectionOptions, type DefaultJobOptions } from 'bullmq';

import type { JobName, JobPayloads } from './definitions.js';

/** Every job goes through one queue; the job name picks the handler. */
export const QUEUE_NAME = 'jobs';

export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  // 5 attempts, waiting 30 s, 1 min, 2 min, and 4 min between them.
  attempts: 5,
  backoff: { type: 'exponential', delay: 30_000 },
  // Completed jobs are deleted so their fixed IDs can be scheduled again.
  removeOnComplete: true,
  // Failed jobs are kept for a week so they can be inspected.
  removeOnFail: { age: 7 * 24 * 60 * 60 },
};

/** BullMQ connection settings for a redis:// URL. */
export function redisConnection(url: string): ConnectionOptions {
  // BullMQ's workers block on Redis and need unlimited retries per request.
  return { url, maxRetriesPerRequest: null };
}

export class JobRunningError extends Error {
  override name = 'JobRunningError';

  constructor(jobId: string) {
    super(`Job ${jobId} is running and can't be replaced or removed.`);
  }
}

export interface JobQueueOptions {
  connection: ConnectionOptions;
  /** Overrides the queue name, so tests can use their own queue. */
  queueName?: string;
  /** Overrides the default retry and cleanup options, e.g. a shorter backoff in tests. */
  defaultJobOptions?: DefaultJobOptions;
}

export interface RepeatSchedule {
  /** Runs every this many milliseconds. */
  every?: number;
  /** Or runs on a cron pattern, e.g. "0 6 * * *". */
  pattern?: string;
  /** Time zone for the cron pattern. Defaults to UTC. */
  tz?: string;
}

/** Adding a job to run as soon as possible: what routes and bot commands need. Tests use a fake. */
export interface JobEnqueuer {
  enqueue<Name extends JobName>(name: Name, data: JobPayloads[Name]): Promise<void>;
  /** Adds many jobs of one kind in a single round trip to Redis. */
  enqueueMany<Name extends JobName>(name: Name, data: JobPayloads[Name][]): Promise<void>;
}

/**
 * The typed way to add jobs, used by the API, the bot, and the worker. Job IDs must not contain
 * ":" (BullMQ uses it as a key separator), so use e.g. `tentative-deadline-42`.
 */
export class JobQueue implements JobEnqueuer {
  readonly queue: Queue;

  constructor({ connection, queueName = QUEUE_NAME, defaultJobOptions }: JobQueueOptions) {
    this.queue = new Queue(queueName, {
      connection,
      defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, ...defaultJobOptions },
    });
  }

  /** Runs a job as soon as a worker is free. */
  async enqueue<Name extends JobName>(name: Name, data: JobPayloads[Name]): Promise<void> {
    await this.queue.add(name, data);
  }

  async enqueueMany<Name extends JobName>(name: Name, data: JobPayloads[Name][]): Promise<void> {
    if (data.length > 0) await this.queue.addBulk(data.map((payload) => ({ name, data: payload })));
  }

  /**
   * Runs a job at `runAt` under a fixed ID. An existing job with that ID is replaced, so calling
   * this again after an event changes moves the job instead of adding a second one. Throws
   * JobRunningError if that job is running right now.
   */
  async schedule<Name extends JobName>(
    name: Name,
    data: JobPayloads[Name],
    { jobId, runAt }: { jobId: string; runAt: Date },
  ): Promise<void> {
    await this.unschedule(jobId);
    await this.queue.add(name, data, { jobId, delay: Math.max(0, runAt.getTime() - Date.now()) });
  }

  /** Removes the job with this ID if there is one. Throws JobRunningError if it's running. */
  async unschedule(jobId: string): Promise<void> {
    const removed = await this.queue.remove(jobId);
    if (removed === 0 && (await this.queue.getJobState(jobId)) !== 'unknown') {
      throw new JobRunningError(jobId);
    }
  }

  /**
   * Runs a job on a schedule under a fixed ID. Calling it again with the same ID updates the
   * schedule and payload instead of adding another one.
   */
  async repeat<Name extends JobName>(
    name: Name,
    data: JobPayloads[Name],
    { schedulerId, ...schedule }: RepeatSchedule & { schedulerId: string },
  ): Promise<void> {
    await this.queue.upsertJobScheduler(schedulerId, { tz: 'UTC', ...schedule }, { name, data });
  }

  /** Stops a repeating job. */
  async stopRepeating(schedulerId: string): Promise<void> {
    await this.queue.removeJobScheduler(schedulerId);
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
