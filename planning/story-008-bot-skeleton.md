# Story 008: Discord bot skeleton

**Status:** Done  
**Phase:** Foundation  
**Depends on:** [Story 002](story-002-docker-dev-environment.md), [Story 003](story-003-testing-setup.md)

## Goal

Have the bot online in a test Discord server and able to answer slash commands.

## Scope

- discord.js client in `src/entrypoints/bot.ts`, connected through the Gateway.
- Slash command registration per Discord server.
- A `/ping` command.
- Clean shutdown when the container stops.

## Out of scope

- Real commands (later stories).

## Acceptance criteria

- [x] The bot comes online in the test server when the `bot` container starts.
- [x] `/ping` replies within 3 seconds, visible only to the user who ran it.
- [x] Commands are registered per server, so they appear immediately.
- [x] If the bot token is missing, the process exits with a clear message.
- [x] Stopping the container disconnects the bot cleanly.
- [x] The README explains how to create the Discord application, enable the Server Members intent, and invite the bot to a test server.

## Notes

- The Server Members privileged intent is required later for role changes and members leaving the server.
- Each process now loads its own config schema (`apiConfigSchema`, `botConfigSchema` in `src/config.ts`), so `DISCORD_BOT_TOKEN` is required only by the bot. With the token empty in `.env`, the bot exits with "DISCORD_BOT_TOKEN is required" and the rest of the stack keeps running. A rejected token or a disabled intent also exits with a message that says what to fix.
- Commands are registered per server on connect and when the bot joins a new server (`guild.commands.set`), which replaces the server's whole command list, so removed commands disappear too.
- `/ping` replies "Pong!" in English only. Story 035 moves it to i18next.
- The containers used to start through `pnpm --filter … dev:*`, and pnpm killed the process with SIGKILL on stop, so the bot never disconnected. `docker-compose.yml` now runs `tsx` directly with `exec` and the `dev:*` scripts are gone. The API and bot now log their shutdown.
- `docker compose restart` doesn't re-read `.env`; after changing it, recreate the container with `docker compose up -d <service>`. The README says so.

## Technical debt

None.
