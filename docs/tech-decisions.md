# Technology decisions

The technology choices for WoW Guild Manager, and why each was made. The product spec is in [`requirements.md`](../requirements.md), and the system diagram is in [`architecture.png`](architecture.png).

Each decision has a status:
- **Accepted**: decided.
- **Proposed**: recommended, waiting for confirmation.
- **Open**: still being discussed.

## Summary

| Area | Choice | Status |
|---|---|---|
| Runtime environment | Docker and Docker Compose | Accepted |
| Language | TypeScript everywhere | Accepted |
| Web client | React with Vite | Accepted |
| Backend | Express 5 | Accepted |
| Repository layout | Monorepo with pnpm workspaces | Accepted |
| Backend processes | One server codebase, run as API, bot, and worker | Accepted |
| Database | PostgreSQL | Accepted |
| ORM | Sequelize 6 | Accepted |
| Cache, sessions, and job queues | Redis with BullMQ | Accepted |
| Discord bot | discord.js over the Discord Gateway | Accepted |
| Validation | Zod, shared by client and server | Accepted |
| Testing | Vitest and Supertest | Accepted |
| Internationalization | i18next (react-i18next on the web) | Accepted |
| UI components | Material UI behind our own compound components | Accepted |
| Linting and formatting | ESLint and Prettier | Accepted |
| Toolchain versions | Node.js 24 LTS, pnpm through corepack, TypeScript 6.0 | Accepted |
| Logging | pino | Accepted |
| File storage | A storage interface, with a local Docker volume in development | Accepted |

## Runtime environment: Docker

**Status:** Accepted

Every part of the system runs in a Docker container, so the whole stack starts locally with one command (`docker compose up`) and behaves the same on every machine.

Local containers:

| Container | Runs |
|---|---|
| `web` | Vite dev server, with hot reload from the mounted source |
| `api` | Express API server |
| `bot` | Discord bot |
| `worker` | Background jobs and scheduler |
| `postgres` | Database, with a named volume so data survives restarts |
| `redis` | Sessions, cache, and job queues |

- `api`, `bot`, and `worker` use the same image with different start commands.
- Database migrations run automatically when the stack starts.
- Credentials (Discord app, Battle.net client) go in a `.env` file. A `.env.example` lists every variable.
- Images: `node:24-trixie-slim` for the app containers, `postgres:18-alpine`, and `redis:8-alpine` (with append-only file persistence).
- A one-shot `deps` service installs dependencies into the `node_modules` volumes on every `docker compose up`, and the other Node.js containers start after it finishes. This keeps dependencies current without rebuilding images and avoids parallel installs into the same volumes.
- In development, the server processes run with `tsx watch` and restart when any file in `apps/server/src` or `packages/shared/src` changes. Node's built-in TypeScript support was considered, but it can't resolve the `.js` import extensions that `NodeNext` uses for `.ts` files.

## Language: TypeScript

**Status:** Accepted

The web client, server, and shared packages are all TypeScript. Shared types and schemas mean the client and server can't drift apart without a compile error.

## Web client: React with Vite

**Status:** Accepted. Next.js was considered and rejected.

A single-page app built with Vite, React, React Router, and TanStack Query.

- React Router is used in library mode (`createBrowserRouter`), with the routes in `src/app/routes.tsx`.
- In development, Vite forwards `/api` to the API (`API_PROXY_TARGET`), so the browser only talks to one origin and the API needs no CORS setup.

**Why not Next.js:** Next.js comes with its own server, API routes, and server-side rendering. With Express as the backend, that would mean two servers with overlapping jobs, and a login cookie shared between them. Next.js is strongest for public sites that need SEO or server rendering. This app is an internal tool behind a login, so it wouldn't use those strengths.

## Backend: Express 5

**Status:** Accepted

Express serves the web client's API and handles the Discord OAuth2 login. Sessions use `express-session` stored in Redis.

- `createApp()` (`apps/server/src/api/app.ts`) builds the app from its dependencies without listening, so tests use it with Supertest. The `api` entry point creates the connections, builds the app, and listens.
- Configuration comes from environment variables, validated with Zod in `apps/server/src/config.ts` when a process starts. A missing or invalid variable stops the process with a message naming it.
- Errors are JSON with a code and no text: `{ "error": { "code": "NOT_FOUND" } }`. The codes and response types live in `packages/shared`. Unhandled errors return `INTERNAL_ERROR` with no details, and the stack trace is logged.
- `GET /api/health` checks PostgreSQL and Redis and returns 503 naming whichever is down.

## Repository layout: monorepo with pnpm workspaces

**Status:** Accepted

One git repository holds the web client, the server, and the code they share, each as its own workspace package.

```
wowGuildManager/
├─ apps/
│  ├─ web/                    React + Vite
│  │  ├─ src/
│  │  │  ├─ pages/            Roster, events, attendance, gear checks, dashboard
│  │  │  ├─ components/
│  │  │  └─ api/              Calls to the server (TanStack Query)
│  │  └─ Dockerfile
│  └─ server/                 Express + discord.js + BullMQ
│     ├─ src/
│     │  ├─ domain/           Rules: sign-ups, waitlist, Tentative deadline, permissions, attendance
│     │  ├─ db/               Sequelize models and migrations
│     │  ├─ api/              Express routes and Discord login
│     │  ├─ bot/              Discord commands and buttons
│     │  ├─ worker/           Scheduled jobs
│     │  ├─ integrations/     Battle.net and Discord API clients
│     │  └─ entrypoints/      api.ts, bot.ts, worker.ts
│     └─ Dockerfile
├─ packages/
│  └─ shared/                 Zod schemas, API types, and game data
├─ docs/
├─ docker-compose.yml
├─ pnpm-workspace.yaml
└─ tsconfig.base.json
```

### What goes where
- **`apps/web`** talks to the server only over HTTP. It never touches the database or Discord directly.
- **`apps/server`** holds the whole backend. Its three entry points run as the `api`, `bot`, and `worker` containers.
- **`packages/shared`** holds only code that must also run in the browser: Zod schemas, API response types, and the game tables (races by faction, classes by race, combat roles by class). It must not import anything server-only, such as Sequelize.
- **Domain rules live in `apps/server/src/domain`,** not in `packages/`, because they use the database (transactions, row locks, models), which only exists on the server.

### Dependency rules
```
web ──→ shared ←── server
```
- `shared` depends on nothing except Zod.
- `web` and `server` never import each other.
- Inside the server, `domain/` doesn't import Express or discord.js, so it can be tested without a running server or bot, and all three entry points use it the same way.

### Why pnpm
- **Strict dependencies:** a package can only import what its own `package.json` declares, so `web` can't import a server library by accident.
- **`pnpm deploy`** builds a minimal folder with one package and only its dependencies, used for the production server image.
- **Per-package commands:** `pnpm --filter server test`, `pnpm --filter web build`.

### Package names and the shared package
- The packages are `@wgm/web`, `@wgm/server`, and `@wgm/shared`.
- `@wgm/shared` has no build step: its `exports` point at its TypeScript source, which Vite and the server's TypeScript tooling read directly. How the production server image handles it is decided when deployment is planned.

npm workspaces were considered: they need no extra tool but aren't strict about dependencies. Turborepo and Nx aren't needed at this size and can be added later.

### Docker and the monorepo
- The Docker build context is the repository root, because every image needs `packages/shared`. A `.dockerignore` keeps the context small.
- Production images use multi-stage builds. The server image contains only the compiled server and its dependencies, not the web client.
- In development, the repository is mounted into the containers for hot reload, and `node_modules` lives in Docker volumes so Linux-built dependencies don't clash with the host's.

## Backend processes: one codebase, three processes

**Status:** Accepted

The API server, Discord bot, and worker live in the same codebase and run as three separate processes. They all use the same domain rules (combat roles by class, slots, waitlist, the Tentative deadline, permissions), so the rules are written once. A process can be split into its own service later if it needs to scale on its own.

## Database: PostgreSQL

**Status:** Accepted

The data is relational (guilds, members, characters, events, sign-ups, attendance), and sign-ups need strong guarantees under concurrency.

**Slot locking happens in PostgreSQL, not in Redis.** When a Discord button click fills a slot, the sign-up runs in a transaction that locks the event row (`SELECT … FOR UPDATE`). Two clicks for the last slot are handled one after the other, and if anything fails, the whole change is rolled back together.

## ORM: Sequelize 6

**Status:** Accepted

Sequelize was chosen over Drizzle ORM for its stability and its large community. Version 6 is the stable release.

### How we use it
- **Typed models.** Models extend `Model<InferAttributes<…>, InferCreationAttributes<…>>` and declare their fields with `declare`, so queries return typed objects.
- **Automatic transaction propagation.** Sequelize is configured with CLS (`Sequelize.useCLS`), so every query inside `sequelize.transaction(async () => { … })` joins that transaction automatically. Without it, a query that forgets `{ transaction: t }` runs outside the transaction with no error, and the slot lock stops protecting sign-ups. The CLS namespace is a small adapter over Node's built-in `AsyncLocalStorage` instead of `cls-hooked`, which Sequelize's docs suggest but which hasn't been maintained since 2017.
- **Row locks for sign-ups.** The sign-up transaction loads the event with `lock: Transaction.LOCK.UPDATE` before counting slots.
- **Migrations.** Migrations are written by hand with `sequelize-cli` and run automatically when the `api` container starts, before it listens (`bot` and `worker` never run them, so they can't race). Every model change needs a matching migration in the same change. Migration files are CommonJS JavaScript, because `sequelize-cli` can't load TypeScript or ES modules.
- **Naming.** Models use `underscored: true`: attributes are camelCase in code and snake_case in the database.
- **Where to look.** `apps/server/src/db/README.md` documents the typed model pattern, transactions, and the migration commands.
- **Validation stays in Zod.** Zod schemas in `packages/shared` are the source of truth for input validation. Sequelize model validations are only used for database-level guarantees (e.g. not null).
- **A test for concurrent sign-ups.** A test sends several sign-ups for the last slot at the same time and checks that only one gets it.

### Options considered

| | Drizzle ORM | Sequelize |
|---|---|---|
| Style | SQL-like query builder, plus a relational query API | Active Record models (classes with methods) |
| TypeScript | Built for it. Types are inferred from the schema | Added later. Models need extra type declarations, and results with `include` are loosely typed |
| Schema and migrations | The schema is TypeScript. `drizzle-kit` generates migrations from schema changes | Models and migrations are written separately and can drift apart |
| Row locks (`FOR UPDATE`) | Supported in the query builder | Supported with `lock` inside a transaction |
| Zod integration | `drizzle-zod` generates Zod schemas from tables | No official integration |
| Hooks and model validation | None. Validation is done with Zod | Built in |
| Maturity | Newer (2022). Faster-moving, with some breaking changes between versions | Mature (2011). Large community and many answered questions |
| Performance and weight | Light. Queries map closely to SQL | Heavier. Queries with many `include`s can be inefficient |
| Learning curve | Needs comfort with SQL | Easier without SQL knowledge |

Drizzle was the stronger fit for type safety and generated migrations. Sequelize was chosen for its maturity and community. The points under "How we use it" cover its main weaknesses for this project.

## Cache, sessions, and job queues: Redis with BullMQ

**Status:** Accepted

Redis stores:
- Web sessions.
- Cached Battle.net and Discord responses.
- BullMQ job queues.

BullMQ handles:
- **Delayed jobs:** the Tentative reminder and deadline, and the gear check 12 hours before a raid. Each is one job per event, scheduled for its exact time.

**How per-event jobs are kept correct.** The Tentative deadline and reminder time are configurable per guild and per event, so their jobs move often:
- Every job has a fixed ID built from its type and event (e.g. `tentative-deadline:<eventId>`). Rescheduling means removing the job with that ID and adding it again, so there are never duplicates.
- Jobs are rescheduled when an event's time or deadline changes, removed when the event is cancelled, and rescheduled for every upcoming event without its own deadline when the guild's settings change (skipping events whose new deadline would already have passed).
- Every job checks the current data when it runs: if the event was cancelled or its deadline moved, it does nothing. A job left behind by a missed reschedule can't replace anyone at the wrong time.

A periodic check (one job every minute looking for due events) was considered. It needs no rescheduling, but runs all the time even with no events. Per-event jobs were chosen.
- **Repeating jobs:** creating instances of recurring events.
- **Retries:** for failed Battle.net or Discord calls.

### Redis client: node-redis

The server uses the official `redis` package (node-redis) for everything: the health check, sessions, and BullMQ. `connect-redis`, the `express-session` store, only supports node-redis, and BullMQ 6 accepts either client, so one client covers all three. ioredis was considered, but it would mean two Redis clients in one codebase.

Clients are created with `disableOfflineQueue: true`, so commands fail right away while Redis is down instead of waiting for it to come back.

## Discord bot: discord.js over the Gateway

**Status:** Accepted

The bot uses discord.js and connects to the Discord Gateway, which is an outgoing WebSocket connection. This means it works on a local machine without exposing a port or using a tunnel. Discord also accepts `http://localhost` as an OAuth2 redirect URL, so the login works locally too.

## Validation: Zod

**Status:** Accepted

Zod schemas in `packages/shared` validate API requests on the server and forms on the web client, from a single definition.

- Game data (factions, races, classes, combat roles, professions) lives in `packages/shared/src/game.ts` as stable snake_case codes (`night_elf`, `first_aid`), with their English display names next to them. The database and the API use the codes.
- Custom checks (e.g. a class that a race can't be) set the Zod issue message to an error code such as `CLASS_NOT_FOR_RACE`, never to text.

## Testing: Vitest and Supertest

**Status:** Accepted

Vitest runs unit tests in both the web client and the server. Supertest runs HTTP tests against the Express app.

- Each package has its own Vitest config, and the root `pnpm test` runs them all. Test files sit next to the code they test (`*.test.ts`). Server tests that aren't about one file go in `apps/server/test/`.
- Web tests run in jsdom.
- **Test database:** server tests use a separate database in the same PostgreSQL container (`<POSTGRES_DB>_test`, from `TEST_DATABASE_URL`). A global setup drops and recreates it at the start of every run, and refuses to touch any database whose name doesn't end in `_test`. During tests, `DATABASE_URL` points at it.
- Tests run inside the Docker containers (`docker compose exec api pnpm test`), where the database is reachable and the environment variables are set.

## Internationalization: i18next

**Status:** Accepted

The app supports English and Spanish (see the Languages section of `requirements.md`). i18next is used everywhere: `react-i18next` in the web client, and i18next directly in the API, bot, and worker. One library means the same translation file format, plural rules, and interpolation on both sides.

- **Translation files:** JSON files per language (`locales/en`, `locales/es`) in each app.
- **Game terms aren't translated.** Class, race, and profession names, combat roles, and ranks are shown in English in both languages. Their display names come from `packages/shared`, so the web client and the bot always show them the same way.
- **Typed keys:** translation keys are typed, so a missing or misspelled key is a TypeScript error.
- **Same keys in both languages:** a test fails if English and Spanish don't have exactly the same keys.
- **The API returns error codes, not text.** Validation and domain errors come back as codes (e.g. `SLOT_FULL`, `CLASS_CANNOT_FILL_ROLE`) with their parameters, and the client translates them. Zod errors are mapped to codes the same way.
- **Dates and numbers** are formatted with the built-in `Intl` APIs for the user's language and time zone.
- **Discord:** the bot picks the language per message as described in `requirements.md`, using the interaction's locale for replies one member sees. Slash commands are registered with Discord's name and description localizations.

## UI components: Material UI behind compound components

**Status:** Accepted

The web client uses Material UI (MUI), themed with the tokens from `docs/design/` (Archivo, square corners, the color tokens for both themes).

App code never imports MUI directly. It uses our own components in `apps/web/src/components/ui`, built with the **compound components** pattern: a parent component that shares state with named child parts, so pages describe the structure without knowing how it's implemented. For example:

```tsx
<RoleSection role="healer">
  <RoleSection.Header />
  <RoleSection.Slots />
  <RoleSection.Waitlist />
</RoleSection>
```

- Only `components/ui` imports `@mui/*`. An ESLint rule (`no-restricted-imports`) blocks MUI imports anywhere else.
- Component props use our own types, not MUI's, so changing the design library later only changes `components/ui`.
- The MUI theme lives next to those components and is built from the design tokens.
- The tokens (`src/components/ui/tokens.ts`) are copied from the prototype for both themes. They're also set as CSS variables under `[data-theme="dark"]` and `[data-theme="light"]`, so our components use the same names as the design (`var(--sf2)`). MUI's `nativeColor` option lets its palette use the `oklch()` colors.
- Archivo is self-hosted with `@fontsource-variable/archivo`, so the app doesn't load fonts from Google.
- Icons are the prototype's SVG paths in an `Icon` component, not an icon package.
- `src/components/ui/index.ts` is the only entry point pages use.

## Linting and formatting: ESLint and Prettier

**Status:** Accepted

ESLint checks code quality (with TypeScript and React rules), and Prettier formats it. Both run on every package from the root, and CI fails on lint errors.

- ESLint uses a flat config (`eslint.config.js`) with typescript-eslint's type-checked rules, and `eslint-config-prettier` so the two don't conflict.
- The web client adds `eslint-plugin-react-hooks`. `eslint-plugin-react` doesn't support ESLint 10 yet; TypeScript already checks JSX.
- Prettier formats code and config files but not Markdown, because its table alignment turns small doc edits into large diffs.

## Toolchain versions

**Status:** Accepted

- **Node.js 24 LTS,** pinned in `.nvmrc` and in `engines` (`>=24 <25`). The Docker images use the same major version.
- **pnpm through corepack:** the `packageManager` field in the root `package.json` pins the exact pnpm version, and corepack (bundled with Node.js 24) installs it, so everyone uses the same one.
- **Install scripts:** pnpm blocks dependencies' install scripts unless they're listed under `allowBuilds` in `pnpm-workspace.yaml`. Only add a package there after checking what its script does.
- **Minimum release age:** pnpm refuses package versions published less than a day ago, to limit exposure to compromised releases. When a new version is rejected, use the previous one instead of adding an exception to `pnpm-workspace.yaml`.
- **TypeScript 6.0:** TypeScript 7 is released, but typescript-eslint doesn't support it yet. Upgrade once it does.

## Logging: pino

**Status:** Accepted

The API, bot, and worker log with pino as structured JSON, with `pino-http` for Express requests. In development, `pino-pretty` makes logs readable.

## File storage: storage interface

**Status:** Accepted

Uploaded files (guild images) go through a small storage interface (save, read, delete). In development, it writes to a Docker volume. In production, it can be switched to an S3-compatible object store without changing the rest of the code. The production provider is chosen when deployment is planned.

## Local development requirements

Each developer needs:
- Docker and Docker Compose.
- Their own Discord application (for the bot and the login) and a test Discord server.
- A Battle.net API client.
