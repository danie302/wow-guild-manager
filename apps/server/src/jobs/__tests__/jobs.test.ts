import { randomUUID } from 'node:crypto';

import type { Worker } from 'bullmq';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestLogger } from '../../test-logger.js';
import type { JobPayloads } from '../definitions.js';
import { JobQueue, redisConnection } from '../queue.js';
import { createJobWorker, type JobHandlers } from '../worker.js';

const connection = redisConnection(process.env.REDIS_URL!);

const opened: { close(): Promise<void> }[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((resource) => resource.close()));
});

/** A queue with its own name, so tests don't see each other's jobs. */
function testQueue(): JobQueue {
  const queue = new JobQueue({
    connection,
    queueName: `test-${randomUUID()}`,
    defaultJobOptions: { attempts: 3, backoff: { type: 'fixed', delay: 50 } },
  });
  opened.push({
    close: async () => {
      await queue.queue.obliterate({ force: true });
      await queue.close();
    },
  });
  return queue;
}

function startWorker(queue: JobQueue, handlers: JobHandlers) {
  const { logger, lines } = createTestLogger();
  const worker: Worker = createJobWorker({
    connection,
    handlers,
    logger,
    queueName: queue.queue.name,
  });
  opened.unshift(worker);
  return { worker, lines };
}

/** Resolves with the payload the next time the ping handler runs. */
function pingHandlers() {
  const runs: { message: string; at: number }[] = [];
  let notify: () => void = () => {};
  const handlers: JobHandlers = {
    ping: ({ message }) => {
      runs.push({ message, at: Date.now() });
      notify();
    },
  };
  const nextRun = () => new Promise<void>((resolve) => (notify = resolve));
  return { handlers, runs, nextRun };
}

describe('job queue', () => {
  it('runs an enqueued job in the worker', async () => {
    const queue = testQueue();
    const { handlers, runs, nextRun } = pingHandlers();
    startWorker(queue, handlers);

    const ran = nextRun();
    await queue.enqueue('ping', { message: 'hello' });
    await ran;

    expect(runs.map((run) => run.message)).toEqual(['hello']);
  });

  it('runs a scheduled job at its time', async () => {
    const queue = testQueue();
    const { handlers, runs, nextRun } = pingHandlers();
    startWorker(queue, handlers);

    const runAt = new Date(Date.now() + 700);
    const ran = nextRun();
    await queue.schedule('ping', { message: 'later' }, { jobId: 'ping-later', runAt });
    await ran;

    expect(runs[0]!.at).toBeGreaterThanOrEqual(runAt.getTime());
  });

  it('retries a failing job with backoff, then marks it failed and logs it', async () => {
    const queue = testQueue();
    const attempts: number[] = [];
    const { worker, lines } = startWorker(queue, {
      ping: () => {
        attempts.push(Date.now());
        throw new Error('boom');
      },
    });
    const failed = new Promise<void>((resolve) => {
      worker.on('failed', (job) => {
        if (job && job.attemptsMade >= 3) resolve();
      });
    });

    await queue.enqueue('ping', { message: 'fails' });
    await failed;

    expect(attempts).toHaveLength(3);
    expect(attempts[1]! - attempts[0]!).toBeGreaterThanOrEqual(50);
    expect(await queue.queue.getFailedCount()).toBe(1);
    const messages = lines().map((line) => [line.level, line.msg, line.attempt]);
    expect(messages).toEqual([
      [40, 'Job attempt failed, will retry', 1],
      [40, 'Job attempt failed, will retry', 2],
      [50, 'Job failed', 3],
    ]);
  });

  it('fails a job with no handler without retrying', async () => {
    const queue = testQueue();
    const { worker, lines } = startWorker(queue, pingHandlers().handlers);
    const failed = new Promise<void>((resolve) => worker.on('failed', () => resolve()));

    await queue.queue.add('unknown', {});
    await failed;

    expect(lines().map((line) => [line.msg, line.attempt])).toEqual([['Job failed', 1]]);
  });
});

describe('scheduling with a fixed ID', () => {
  it('replaces the existing job instead of adding a second one', async () => {
    const queue = testQueue();
    const inAnHour = new Date(Date.now() + 60 * 60 * 1000);
    const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await queue.schedule('ping', { message: 'first' }, { jobId: 'reminder-1', runAt: inAnHour });
    await queue.schedule('ping', { message: 'second' }, { jobId: 'reminder-1', runAt: inTwoHours });
    await queue.schedule('ping', { message: 'other' }, { jobId: 'reminder-2', runAt: inAnHour });

    const jobs = await queue.queue.getDelayed();
    expect(jobs.map((job) => [job.id, job.data as JobPayloads['ping']]).sort()).toEqual([
      ['reminder-1', { message: 'second' }],
      ['reminder-2', { message: 'other' }],
    ]);
    const job = jobs.find((candidate) => candidate.id === 'reminder-1')!;
    expect(job.timestamp + job.delay).toBeGreaterThan(inAnHour.getTime());
  });

  it('can schedule an ID again after its job has run', async () => {
    const queue = testQueue();
    const { handlers, runs, nextRun } = pingHandlers();
    startWorker(queue, handlers);

    for (const message of ['once', 'twice']) {
      const ran = nextRun();
      await queue.schedule('ping', { message }, { jobId: 'same', runAt: new Date() });
      await ran;
      // The handler has run, but the finished job is removed a moment later; until then its
      // ID is still taken.
      await vi.waitFor(async () => expect(await queue.queue.getJob('same')).toBeUndefined());
    }

    expect(runs.map((run) => run.message)).toEqual(['once', 'twice']);
  });

  it('removes a job by ID, and ignores IDs that have no job', async () => {
    const queue = testQueue();
    const runAt = new Date(Date.now() + 60_000);
    await queue.schedule('ping', { message: 'cancel me' }, { jobId: 'cancelled', runAt });

    await queue.unschedule('cancelled');
    await queue.unschedule('never-existed');

    expect(await queue.queue.getDelayedCount()).toBe(0);
  });
});

describe('repeating jobs', () => {
  it('updates the schedule when called again with the same ID', async () => {
    const queue = testQueue();

    await queue.repeat('ping', { message: 'a' }, { schedulerId: 'daily', pattern: '0 6 * * *' });
    await queue.repeat('ping', { message: 'b' }, { schedulerId: 'daily', pattern: '0 7 * * *' });

    const schedulers = await queue.queue.getJobSchedulers();
    expect(schedulers.map((scheduler) => [scheduler.key, scheduler.pattern])).toEqual([
      ['daily', '0 7 * * *'],
    ]);

    await queue.stopRepeating('daily');
    expect(await queue.queue.getJobSchedulers()).toEqual([]);
  });
});

describe('job types', () => {
  it('rejects wrong job names and payloads at compile time', () => {
    const typeChecks = (queue: JobQueue) => {
      // @ts-expect-error: unknown job name
      void queue.enqueue('nope', { message: 'x' });
      // @ts-expect-error: wrong payload field type
      void queue.enqueue('ping', { message: 42 });
      // @ts-expect-error: missing payload field
      void queue.enqueue('ping', {});
      const valid: JobPayloads['ping'] = { message: 'ok' };
      void queue.enqueue('ping', valid);
    };
    expect(typeChecks).toBeTypeOf('function');
  });
});
