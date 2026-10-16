# Story 003: Testing setup

**Status:** Done  
**Phase:** Foundation  
**Depends on:** [Story 002](story-002-docker-dev-environment.md)

## Goal

Make it possible to write and run tests in every package from the first feature on.

## Scope

- Vitest configured in `apps/web`, `apps/server`, and `packages/shared`.
- Supertest installed in `apps/server`.
- A separate test database in the PostgreSQL container, reset between test runs.
- Root scripts to run all tests, one package's tests, or a single test file.

## Out of scope

- Tests for features (each story adds its own).

## Acceptance criteria

- [x] `pnpm test` at the root runs every package's tests.
- [x] A single test file can be run on its own, and the command is documented in `CLAUDE.md`.
- [x] Tests run inside the Docker containers with `docker compose exec`.
- [x] Server tests use the test database and never touch the development database.
- [x] One example test passes in each package.

## Notes

- The test database is `<POSTGRES_DB>_test` (`wgm_test` by default), passed to the server as `TEST_DATABASE_URL`. A Vitest global setup (`apps/server/test/global-setup.ts`) drops and recreates it at the start of every server test run. It refuses to run if the name doesn't end in `_test` or matches the development database.
- During tests, `DATABASE_URL` points at the test database, so server code never needs to know it's under test.
- Server tests only run inside Docker, where `TEST_DATABASE_URL` is set. On the host they stop with a message saying so.
- Story 005 must run the migrations in the global setup after the database is recreated.
- The web tests use jsdom.
- The `pg` driver was added now for the global setup. Sequelize uses it too (story 005).

## Technical debt

None.
