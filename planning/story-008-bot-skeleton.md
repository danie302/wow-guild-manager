# Story 008: Discord bot skeleton

**Status:** Not started  
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

- [ ] The bot comes online in the test server when the `bot` container starts.
- [ ] `/ping` replies within 3 seconds, visible only to the user who ran it.
- [ ] Commands are registered per server, so they appear immediately.
- [ ] If the bot token is missing, the process exits with a clear message.
- [ ] Stopping the container disconnects the bot cleanly.
- [ ] The README explains how to create the Discord application, enable the Server Members intent, and invite the bot to a test server.

## Notes

- The Server Members privileged intent is required later for role changes and members leaving the server.

## Technical debt

None.
