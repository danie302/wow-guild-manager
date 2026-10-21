import type { JobName, JobPayloads } from '../src/jobs/definitions.js';
import type { JobEnqueuer } from '../src/jobs/queue.js';

/** Keeps the jobs instead of adding them to Redis, so tests can check and run them. */
export class FakeJobQueue implements JobEnqueuer {
  readonly jobs: { name: JobName; data: unknown; jobId?: string; runAt?: Date }[] = [];

  enqueue<Name extends JobName>(name: Name, data: JobPayloads[Name]): Promise<void> {
    this.jobs.push({ name, data });
    return Promise.resolve();
  }

  enqueueMany<Name extends JobName>(name: Name, data: JobPayloads[Name][]): Promise<void> {
    for (const payload of data) this.jobs.push({ name, data: payload });
    return Promise.resolve();
  }

  enqueueOnce<Name extends JobName>(
    name: Name,
    data: JobPayloads[Name],
    { jobId, runAt }: { jobId: string; runAt: Date },
  ): Promise<void> {
    if (!this.jobs.some((job) => job.jobId === jobId)) this.jobs.push({ name, data, jobId, runAt });
    return Promise.resolve();
  }

  /** The payloads of the jobs with this name. */
  payloads<Name extends JobName>(name: Name): JobPayloads[Name][] {
    return this.jobs.filter((job) => job.name === name).map((job) => job.data as JobPayloads[Name]);
  }
}
