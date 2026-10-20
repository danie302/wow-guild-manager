# Story 009: Worker and job queue skeleton

**Status:** Done  
**Phase:** Foundation  
**Depends on:** [Story 002](story-002-docker-dev-environment.md), [Story 003](story-003-testing-setup.md)

## Goal

Have background jobs running, so later stories can schedule work.

## Scope

- BullMQ queues and the worker process in `src/entrypoints/worker.ts`.
- Typed job names and payloads defined in one module.
- A helper to enqueue immediate, delayed, and repeating jobs from any server process.
- Retries with backoff and logging of failed jobs.

## Out of scope

- Real jobs (later stories).

## Acceptance criteria

- [x] A job enqueued by the API is processed by the `worker` container.
- [x] A delayed job runs at its scheduled time (tested with a short delay).
- [x] A failing job is retried with backoff, then marked as failed and logged.
- [x] Pending jobs survive a restart of the `worker` and `redis` containers.
- [x] Enqueuing a job with a wrong payload is a TypeScript error.
- [x] A helper schedules a delayed job with a fixed ID, replacing any existing job with that ID, and another removes a job by ID. Tests show rescheduling never leaves duplicates.

## Notes

- BullMQ 6 uses ioredis 5 inside (its default client), while our own code keeps node-redis. See "Redis clients" in `docs/tech-decisions.md`.
- One `jobs` queue for everything; the job name picks the handler. The only job is `ping`, which logs a message, so the queue can be checked end to end. Later stories add the real ones.
- Defaults: 5 attempts with exponential backoff from 30 s, completed jobs deleted, failed jobs kept 7 days, worker concurrency 5.
- BullMQ rejects `:` in custom job IDs, so the per-event IDs are `tentative-deadline-<eventId>`, not `tentative-deadline:<eventId>` as the docs said before. CLAUDE.md and the tech decisions are updated.
- The API creates a `JobQueue` at startup and closes it on shutdown, ready for later routes. The live check enqueued from a script inside the `api` container: an immediate job, a job 10 s later (ran on time), and a job 45 s later that survived stopping the worker and restarting Redis.
- `msgpackr-extract` (an optional native speed-up pulled in by BullMQ) is listed as `false` in `allowBuilds`, so pnpm skips its install script without failing.
- Server tests use Redis database 1 (`TEST_REDIS_URL`), emptied by the global setup on every run.

## Technical debt

- `schedule` removes the old job and then adds the new one in two steps. Two calls for the same ID at the same moment could leave the first call's payload instead of the last one's (never a duplicate). And if the job is running at that moment, `JobRunningError` is thrown and the caller has to handle it. Neither matters yet; revisit when story 026 reschedules jobs from settings changes.
