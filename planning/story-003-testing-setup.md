# Story 003: Testing setup

**Status:** Not started  
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

- [ ] `pnpm test` at the root runs every package's tests.
- [ ] A single test file can be run on its own, and the command is documented in `CLAUDE.md`.
- [ ] Tests run inside the Docker containers with `docker compose exec`.
- [ ] Server tests use the test database and never touch the development database.
- [ ] One example test passes in each package.

## Technical debt

None.
