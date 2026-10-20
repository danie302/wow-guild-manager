# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Early implementation: the foundation stories are in progress (see `planning/README.md`). `requirements.md` is the product spec and the source of truth for features, ranks, permissions, and event rules. Read it before implementing anything. If it doesn't define a behavior, ask instead of assuming. The stack is decided and documented in `docs/tech-decisions.md`: Docker Compose for local development, TypeScript, React + Vite, Express 5, Sequelize 6 on PostgreSQL, Redis with BullMQ, discord.js, Zod, and Vitest with Supertest, in a pnpm monorepo. Check `planning/README.md` for the next story.

## Commands

Use Node.js 24 (`.nvmrc`) and pnpm through corepack. In a fresh shell, run `source ~/.nvm/nvm.sh && nvm use` first.

- `cp .env.example .env && docker compose up`: run the whole stack (web on :5173, API on :3000). `docker compose down -v` resets the data. Details are in `README.md`. After editing `.env`, use `docker compose up -d` (not `restart`, which keeps the old environment). The bot needs `DISCORD_BOT_TOKEN`; without it only the `bot` container exits.
- `pnpm install`: install every workspace on the host (containers install their own into Docker volumes). pnpm rejects versions published less than a day ago: pick the previous version, and don't add `minimumReleaseAgeExclude` entries. After adding a dependency with the stack running, run `docker compose up -d` and then `docker compose restart api bot worker web`.
- `pnpm typecheck`: typecheck every package (`pnpm --filter @wgm/web typecheck` for one).
- `pnpm lint`: ESLint over the whole repo.
- `pnpm format` / `pnpm format:check`: Prettier (code and config only, not Markdown).

Tests run inside Docker with the stack up (server tests need the test database and fail on the host):

- `docker compose exec api pnpm test`: every package's tests.
- `docker compose exec api pnpm --filter @wgm/server test`: one package (`@wgm/web`, `@wgm/shared`).
- `docker compose exec api pnpm --filter @wgm/server test test/test-database.test.ts`: a single file (path relative to the package).
- `docker compose exec api pnpm --filter @wgm/server test -t "starts every run empty"`: tests whose name matches.

Database migrations (details and the typed model pattern in `apps/server/src/db/README.md`):

- `docker compose exec api pnpm --filter @wgm/server db:migration:create --name <name>`: new migration (CommonJS `.js`).
- `docker compose exec api pnpm --filter @wgm/server db:migrate` / `db:migrate:undo`: apply pending migrations or revert the last one. The `api` container also applies them on start.

Test files are `*.test.ts` next to the code. Server tests use `wgm_test` and Redis database 1, which are reset on every run.

## Planning workflow

Work is planned as small stories in `planning/` (`story-NNN-*.md`, with the index and status definitions in `planning/README.md`). When working on a story:

- Resolve the assumptions and open decisions in its **Notes** first, asking if needed.
- Check off acceptance criteria as they're met, and update the status in both the story file and the index.
- Record anything left unfinished or worth improving in the story's **Technical debt** section, and use the **Done with debt** status if any remains.
- Record new technology decisions in `docs/tech-decisions.md`.
- If a story changes how to set up or run the project (Docker, environment variables, Discord or Battle.net credentials, commands), update the **Getting started** section of `README.md`. Keep its feature list in sync with `requirements.md`.

## Design

The web app's visual design is a Claude Design prototype in `docs/design/`. Read `docs/design/README.md` first: it maps screens to stories, lists the design tokens, and lists where the design differs from `requirements.md`. The requirements win over the design. The prototype is a reference, not code to copy.

## Architecture

The diagram is in `docs/architecture.svg` (source) and `docs/architecture.png` (rendered from the SVG; re-render it after editing the SVG).

The product has two front ends that share one backend and database:

- **Web app**: the Guild Master and Officers log in with Discord to manage the roster, events, attendance, and gear checks. Roster members can also log in with read-only access to upcoming events and the roster. Guild gold and items are managed in the game and are out of scope.
- **Discord bot**: where members act. It posts events, takes sign-ups through buttons, handles `/register`, and sends reminders and missing-role alerts. Members never sign up or change anything through the web app.

Sign-up rules (combat roles by class, slots, waitlist, Tentative deadline) must live in the shared backend, not in the bot or the web app, so both apply the same rules.

The code is a pnpm monorepo (layout and reasoning in `docs/tech-decisions.md`):

- `apps/web`: the React + Vite client. It only talks to the server over HTTP.
- `apps/server`: the Express API, Discord bot, and worker, as one codebase with three entry points (`src/entrypoints/api.ts`, `bot.ts`, `worker.ts`) that run as separate containers.
- `packages/shared`: Zod schemas, API types, and game tables, consumed as TypeScript source with no build step. Only code that can also run in the browser goes here.

UI rule: the web client uses Material UI only inside `apps/web/src/components/ui`, behind our own compound components (e.g. `<AppShell>` with `<AppShell.NavItem>`). Pages and features never import `@mui/*` or `@emotion/*` directly (an ESLint rule enforces it). They import from `src/components/ui/index.ts`, and component props use our own types, so the design library can be swapped. Colors come from the design tokens in `src/components/ui/tokens.ts`, used as CSS variables (`var(--sf2)`).

Dependency rules: `web` and `server` depend on `shared` and never on each other. `shared` imports nothing server-only (no Sequelize). Domain rules live in `apps/server/src/domain` and don't import Express or discord.js.

## Implementation notes

These rules come from `requirements.md` and should be enforced on the server and in the data layer, not only in the UI:

- **Members are roster records identified by a Discord account.** The GM and Officers manage the guild in the web app. Roster members can log in with read-only access. Sign-ups and attendance attach to a character, and characters belong to a member. A user leads at most one guild at a time. A character is in at most one guild. Each guild connects to one Discord server.
- **Faction, race, and class are validated together.** Faction limits race and race limits class (use the table in `requirements.md`, which differs from standard Classic). A character can only be on the roster of a guild of the same faction. There are no realms.
- **A guild always has exactly one Guild Master.**
- **Permissions don't follow a simple hierarchy.** Some actions are GM-only (e.g. pre-confirming raid participants), and Officers can only change the rank of, or remove, Raiders and Members. Use the permission tables in `requirements.md`. Don't infer permissions from rank order.
- **Attendance changes are audited.** Corrections record who made them and when.
- **Sign-up capacity must be safe against concurrent sign-ups.** Discord button clicks arrive in parallel. Filling a role, adding to the waitlist, and promoting from it must run in one Sequelize transaction that first locks the event row (`lock: Transaction.LOCK.UPDATE`). Sequelize uses CLS (`Sequelize.useCLS` in `apps/server/src/db/sequelize.ts`) so queries join the transaction automatically. Don't remove that setup.
- **Every Sequelize model change needs a migration** in the same change. Migrations are hand-written with `sequelize-cli`, as CommonJS files in `apps/server/src/db/migrations`.
- **Removing a member is a soft delete.** Their member and character records stay (marked as removed) so past sign-ups and attendance remain intact. The one-guild-at-a-time constraint on characters applies only to active (not removed) records, e.g. with a partial unique index. Adding a removed member back to the same guild restores their old record and history instead of creating a new one.
- **Releasing a spot** (removal from the roster, withdrawing, or Tentative expiry) promotes the earliest waitlisted character with the same combat role, and the Discord post must update.
- **Read-only member access is filtered on the server.** Data members can't see (officer notes, rank history, pending registrations, the attendance report, other people's gear check results, past events, "left Discord" flags, settings) must never be included in responses to a member's session, not just hidden in the UI. See "Read-only access for members" in `requirements.md`.
- **Officer access comes from a Discord role.** The GM picks which role grants Officer. Check it when permissions are evaluated (or keep it synced from Discord events), so removing the role in Discord removes app access right away.
- **Time-based jobs are one BullMQ delayed job per event, with a fixed job ID** (e.g. `tentative-deadline-<eventId>`; BullMQ doesn't allow `:` in job IDs). Reschedule them when an event's time or deadline changes or the guild's settings change, remove them when it's cancelled, and make every job re-check the current data before acting. The Tentative deadline and reminder time are configurable per guild (and the deadline per event), so never hard-code 24 hours.
- **Background jobs go through `JobQueue`** (`apps/server/src/jobs/`). Add each new job's name and payload to `definitions.ts` and its handler to `handlers/`. Use `schedule`/`unschedule` with a fixed ID for per-event jobs and `repeat` for recurring ones.
- **Time-based jobs are needed:** the Tentative reminder and the replacement at the Tentative deadline, the automatic gear check 12 hours before a raid (with DMs to players who have problems), the missing-role alerts 48 and 24 hours before an event, and creating the next 2 weeks of events in each recurring series.
- **Gear checks and `/register` depend on the external Battle.net API.** Support for World of Warcraft: Forever is unconfirmed, so build against the Classic API behind an interface that can be swapped. Call it from background jobs, not from page requests. Cache the responses with their fetch time, respect its rate limits, and keep the API credentials on the server. Its data only updates after a player logs out, so always show when it was last updated. A failed or missing lookup must not break the event page.
- **No hard-coded user-facing text.** Every string a person reads (web, bot replies, DMs, Discord posts) goes through i18next with both English and Spanish translations. The API returns error codes, never translated text. Game terms (classes, races, professions, combat roles, ranks) stay in English in both languages; don't add translation keys for them. Text people write (event names, notes) isn't translated.
- **Times are stored in UTC.** The web app shows them in the app user's time zone. Discord posts use Discord timestamps, which show each reader's local time.
