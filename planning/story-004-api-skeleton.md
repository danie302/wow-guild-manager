# Story 004: Express API skeleton and health check

**Status:** Not started  
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

- [ ] `GET /api/health` returns 200 with the status of the database and Redis when both are up.
- [ ] If PostgreSQL or Redis is down, `GET /api/health` returns 503 and names which one is failing.
- [ ] Unknown routes return a 404 JSON response.
- [ ] Unhandled errors return a 500 JSON response with no stack trace. The stack trace is logged.
- [ ] If a required environment variable is missing, the process exits with a message naming the variable.
- [ ] Supertest tests cover the health check (both up, and each one down), 404, and 500.


## Technical debt

None.
