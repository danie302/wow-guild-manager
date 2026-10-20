# WoW Guild Manager

A web app and Discord bot for running a World of Warcraft: Forever guild.

The Guild Master and Officers use the web app to manage the roster, schedule raids, dungeons, and PvP events, track attendance, and check everyone's gear before a raid. Members never need to learn a new tool: they sign up for events with buttons in Discord, register their characters with `/register`, and can open the web app in read-only mode to see upcoming events and the roster.

The app is available in English and Spanish.

## Features

- **Discord login** for everyone, with access based on the guild's roster and a Discord role for Officers.
- **Roster** of members and their characters (main and alts), with ranks, officer notes, and rank history.
- **Character registration** from Discord with `/register`, checked against the Battle.net API and approved by an Officer.
- **Events** (raids, dungeons, and PvP) with slots per combat role, weekly recurring events, and a post in Discord that updates in real time.
- **Sign-ups from Discord** with a waitlist per role, and a configurable deadline for Tentative sign-ups with reminders.
- **Missing-role alerts** in Discord before each event.
- **Attendance tracking** with six statuses, attendance rates per period and event type, and configurable Good / Watch / At risk bands.
- **Gear checks** before raids using the Battle.net API: empty slots, missing enchants, and direct messages to players who need to fix something.
- **Read-only view** for members: upcoming events, the roster, and their own gear check and attendance.

## Status

Early implementation. The foundation is in place (Docker stack, API, database, Discord bot, background jobs, English and Spanish), along with Discord login and each user's language, time zone, and theme settings. Guild, roster, and event features come next. Work is split into small stories in [`planning/`](planning/README.md), with their status in the index.

## Tech stack

TypeScript in a pnpm monorepo, run locally with Docker Compose:

- **Web client:** React with Vite, Material UI behind our own components
- **Backend:** Express 5, with the API, Discord bot (discord.js), and background worker as three processes of one codebase
- **Data:** PostgreSQL with Sequelize, and Redis with BullMQ for sessions, caching, and scheduled jobs
- **Shared:** Zod for validation and i18next for English and Spanish
- **Quality:** Vitest, Supertest, ESLint, and Prettier

The reasons behind each choice are in [`docs/tech-decisions.md`](docs/tech-decisions.md).

## Getting started

Instructions for the Battle.net API client will be added with its story (017).

### Set up Discord

The bot and the web app's login share one Discord application, and you need a Discord server to test in. Each developer creates their own.

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**. Give it any name.
2. On the **Bot** page:
   - Click **Reset Token**, copy the token, and put it in `.env` as `DISCORD_BOT_TOKEN`. Treat it like a password.
   - Under **Privileged Gateway Intents**, turn on **Server Members Intent** and save. The bot needs it to see role changes and members leaving the server. Without it, the bot can't connect.
3. Create a test server in Discord: click **+** in the server list, then **Create My Own**.
4. Invite the bot: on the **OAuth2** page, open **URL Generator**, tick the **bot** and **applications.commands** scopes, and under **Bot Permissions** tick **View Channels**, **Send Messages**, **Embed Links**, and **Read Message History**. Open the generated URL and pick your test server.
5. Set up the web login: on the **OAuth2** page:
   - Copy the **Client ID** into `.env` as `DISCORD_CLIENT_ID`.
   - Click **Reset Secret** and put it in `.env` as `DISCORD_CLIENT_SECRET`. Treat it like a password.
   - Under **Redirects**, add `http://localhost:5173/api/auth/discord/callback` and save. If you changed `WEB_PORT`, use that port instead.
6. Recreate the containers with `docker compose up -d` (`restart` keeps the old environment and doesn't read `.env` again).
   - The bot's log (`docker compose logs bot`) shows "Bot online" and "Registered slash commands". In the test server, type `/ping`: the bot answers with a message only you can see.
   - Open http://localhost:5173 and click **Log in with Discord**.

Without `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`, the API still runs, but the login page says that login isn't set up. `SESSION_SECRET` comes with a value for local development in `.env.example`; an `.env` made before the login existed needs it added.

The bot registers its commands on every server it's in when it connects, and on new servers as soon as it's invited, so they appear right away.

### Run the stack with Docker

You only need Docker (Docker Desktop on macOS or Windows). Node.js, PostgreSQL, and Redis all run in containers.

```sh
cp .env.example .env
docker compose up
```

The first start builds the images and installs dependencies, which takes a few minutes. Then:

| Service | URL or port | What it is |
|---|---|---|
| `web` | http://localhost:5173 | Web app (Vite dev server, reloads when you save a file in `apps/web`). Every page needs a Discord login (see "Set up Discord"). Once logged in, http://localhost:5173/status shows the API, database, and Redis status |
| `api` | http://localhost:3000 | Express API |
| `postgres` | `localhost:5432` | PostgreSQL, for database tools (user, password, and database are in `.env`) |
| `redis` | `localhost:6379` | Redis, for Redis tools |
| `bot`, `worker` | No port | Discord bot and background worker. The bot stops with a message until `DISCORD_BOT_TOKEN` is set (see "Set up Discord") |

`api`, `bot`, and `worker` restart automatically when you save a file in `apps/server` or `packages/shared`. If a port is already in use on your machine, change it in `.env`.

- `docker compose down` stops the stack and keeps the database and Redis data.
- `docker compose down -v` also deletes the data volumes, including `node_modules`, for a clean start.
- `docker compose logs -f api` follows one service's logs.
- The `api` container applies pending database migrations when it starts, but not when it restarts after a file change. After pulling or writing a new migration, run `docker compose exec api pnpm --filter @wgm/server db:migrate` (`db:migrate:undo` reverts the last one).
- After changing `.env`, run `docker compose up -d` to recreate the affected containers. `docker compose restart` keeps the old environment.
- http://localhost:3000/api/health shows whether the API can reach PostgreSQL and Redis.
- After adding or updating a dependency, run `docker compose up -d` (the `deps` service installs it into the containers) and then `docker compose restart api bot worker web`. A process that crashed on a missing package waits for a file change, so it won't recover on its own.

### Run the tests

With the stack running:

```sh
docker compose exec api pnpm test                                   # every package
docker compose exec api pnpm --filter @wgm/web test                 # one package
docker compose exec api pnpm --filter @wgm/server test <file path>  # one file
```

Server tests use a separate `wgm_test` database and Redis database 1, both reset on every run, so they never touch your development data or queued jobs.

### Local tools (optional)

To run type checks, lint, and formatting on your machine (and for editor support), install:

- Node.js 24 (the version is in `.nvmrc`; with nvm, run `nvm install` and then `nvm use`).
- pnpm, through corepack: run `corepack enable` once. The pnpm version comes from the `packageManager` field in `package.json`.

### Install and check

```sh
pnpm install
pnpm typecheck      # TypeScript in every package
pnpm lint           # ESLint
pnpm format:check   # Prettier (pnpm format fixes formatting)
```

## Documentation

| Document | What it covers |
|---|---|
| [`requirements.md`](requirements.md) | The product spec: features, permissions, and rules |
| [`docs/tech-decisions.md`](docs/tech-decisions.md) | The technology choices and why they were made |
| [`docs/architecture.png`](docs/architecture.png) | How the web client, Discord, backend, database, cache, and Battle.net connect |
| [`docs/design/`](docs/design/README.md) | The visual design prototype and how its screens map to stories |
| [`planning/`](planning/README.md) | The implementation plan as small stories with acceptance criteria |
| [`CLAUDE.md`](CLAUDE.md) | Guidance for Claude Code when working in this repository |
