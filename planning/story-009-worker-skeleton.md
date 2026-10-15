# Story 009: Worker and job queue skeleton

**Status:** Not started  
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

- [ ] A job enqueued by the API is processed by the `worker` container.
- [ ] A delayed job runs at its scheduled time (tested with a short delay).
- [ ] A failing job is retried with backoff, then marked as failed and logged.
- [ ] Pending jobs survive a restart of the `worker` and `redis` containers.
- [ ] Enqueuing a job with a wrong payload is a TypeScript error.
- [ ] A helper schedules a delayed job with a fixed ID, replacing any existing job with that ID, and another removes a job by ID. Tests show rescheduling never leaves duplicates.

## Technical debt

None.
