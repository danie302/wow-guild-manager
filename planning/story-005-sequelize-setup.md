# Story 005: Database setup with Sequelize

**Status:** Done  
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

- [x] The server connects to PostgreSQL using environment variables.
- [x] A test proves that a query inside `sequelize.transaction(async () => { … })`, without passing `{ transaction }`, is rolled back when the transaction fails.
- [x] `db:migrate`, `db:migrate:undo`, and `db:migration:create` scripts work inside the container.
- [x] The `api` container runs pending migrations before it starts listening.
- [x] The `bot` and `worker` containers don't run migrations, so they can't race with `api`.
- [x] The typed model pattern is documented with an example.

## Notes

- The CLS namespace is a small adapter over Node's `AsyncLocalStorage` (`apps/server/src/db/cls.ts`), not the unmaintained `cls-hooked` package. A test proves that queries without `{ transaction }` roll back with the transaction, and it fails if `useCLS` is removed.
- Migrations are CommonJS `.js` files, because `sequelize-cli` can't load TypeScript or ES modules. `src/db/migrations/package.json` sets `"type": "commonjs"` for that folder.
- The `api` container runs `db:migrate` before starting the server. Saving a file restarts the server without re-running migrations. Run `db:migrate` after adding one.
- Models use `underscored: true`, so columns are snake_case.
- The health check now uses `sequelize.authenticate()` instead of a separate `pg` pool. `pg` stays as the driver Sequelize needs, and the test setup uses it directly.
- The typed model pattern and the migration commands are documented in `apps/server/src/db/README.md`.

## Technical debt

None.
