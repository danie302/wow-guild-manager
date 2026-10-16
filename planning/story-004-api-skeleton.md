# Story 004: Express API skeleton and health check

**Status:** Done  
**Phase:** Foundation  
**Depends on:** [Story 003](story-003-testing-setup.md)

## Goal

Have a running Express 5 API with the basics every endpoint needs.

## Scope

- `createApp()` builds the Express app, separate from the code that starts listening.
- Configuration from environment variables, validated with Zod at startup.
- JSON error handling, and request logging with pino and `pino-http` (readable with `pino-pretty` in development).
- `GET /api/health` reporting the status of PostgreSQL and Redis.

## Out of scope

- Authentication (story 010).

## Acceptance criteria

- [x] `GET /api/health` returns 200 with the status of the database and Redis when both are up.
- [x] If PostgreSQL or Redis is down, `GET /api/health` returns 503 and names which one is failing.
- [x] Unknown routes return a 404 JSON response.
- [x] Unhandled errors return a 500 JSON response with no stack trace. The stack trace is logged.
- [x] If a required environment variable is missing, the process exits with a message naming the variable.
- [x] Supertest tests cover the health check (both up, and each one down), 404, and 500.

## Notes

- Errors use the shape `{ "error": { "code": "NOT_FOUND" } }`. The codes and the response types (`ApiErrorResponse`, `HealthResponse`) live in `packages/shared`, so the web client can use them.
- A malformed JSON body returns 400 with `INVALID_JSON` instead of 500.
- `GET /api/health` returns `{ "status": "ok" | "error", "checks": { "database": "up" | "down", "redis": "up" | "down" } }`. Each check times out after 2 seconds.
- The server uses the official `redis` client (node-redis), not ioredis. See `docs/tech-decisions.md`.
- The database check uses a `pg` pool for now. Story 005 can switch it to Sequelize.
- Configuration lives in `apps/server/src/config.ts`. `DATABASE_URL` and `REDIS_URL` are set by `docker-compose.yml`. `PORT` (default 3000) and `LOG_LEVEL` (default `info`) are optional. An empty variable counts as missing.

## Technical debt

None.
