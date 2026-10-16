# Story 005: Database setup with Sequelize

**Status:** Not started  
**Phase:** Foundation  
**Depends on:** [Story 004](story-004-api-skeleton.md)

## Goal

Connect the server to PostgreSQL with Sequelize, safe transactions, and automatic migrations.

## Scope

- Sequelize 6 connection from environment variables.
- CLS (`Sequelize.useCLS`) so queries join the current transaction automatically.
- `sequelize-cli` configuration and a migrations folder.
- Migrations run automatically when the `api` container starts.
- The test global setup (`apps/server/test/global-setup.ts`, story 003) runs the migrations on the test database after recreating it.
- A documented pattern for typed models (`InferAttributes`, `InferCreationAttributes`, `declare`).

## Out of scope

- Domain tables (each feature story adds its own).

## Acceptance criteria

- [ ] The server connects to PostgreSQL using environment variables.
- [ ] A test proves that a query inside `sequelize.transaction(async () => { … })`, without passing `{ transaction }`, is rolled back when the transaction fails.
- [ ] `db:migrate`, `db:migrate:undo`, and `db:migration:create` scripts work inside the container.
- [ ] The `api` container runs pending migrations before it starts listening.
- [ ] The `bot` and `worker` containers don't run migrations, so they can't race with `api`.
- [ ] The typed model pattern is documented with an example.

## Technical debt

None.
