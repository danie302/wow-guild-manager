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

Early implementation. The monorepo scaffold is in place, and no application features exist yet. Work is split into small stories in [`planning/`](planning/README.md).

## Tech stack

TypeScript in a pnpm monorepo, run locally with Docker Compose:

- **Web client:** React with Vite, Material UI behind our own components
- **Backend:** Express 5, with the API, Discord bot (discord.js), and background worker as three processes of one codebase
- **Data:** PostgreSQL with Sequelize, and Redis with BullMQ for sessions, caching, and scheduled jobs
- **Shared:** Zod for validation and i18next for English and Spanish
- **Quality:** Vitest, Supertest, ESLint, and Prettier

The reasons behind each choice are in [`docs/tech-decisions.md`](docs/tech-decisions.md).

## Getting started

Instructions for Docker, the Discord application, and the Battle.net API client will be added as their setup stories are completed.

### Prerequisites

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
