# Story 034: Dashboard

**Status:** Blocked  
**Phase:** Leadership and dashboard  
**Depends on:** [Story 018](story-018-register-command.md), [Story 019](story-019-member-left-discord.md), [Story 024](story-024-withdraw-and-waitlist.md), [Story 026](story-026-tentative-deadline.md), [Story 031](story-031-gear-check.md)

## Goal

Show the Guild Master and Officers what needs attention on the app's home page.

## Scope

- The home page with every section listed in `requirements.md`.

## Acceptance criteria

- [x] The dashboard shows upcoming events and how full each combat role is.
- [x] It shows events with missing roles.
- [x] It shows Tentative sign-ups close to their event's Tentative deadline.
- [ ] It shows participants in upcoming raids with empty slots or missing enchants. (Waits for story 031; see Technical debt.)
- [x] It shows pending requests to join.
- [x] It shows members who left the guild's Discord server.
- [x] Each item links to the page where it can be handled.
- [x] The Guild Master and Officers land on the dashboard after login. It follows screen 03 in `docs/design/`.

## Notes

- Everything but the gear section is done (2026-10-22). The gear section waits for the gear check (story 031), which waits for Blizzard's API (story 037).

## Technical debt

- The dashboard uses the design's windows: missing roles for events in the next 8 days, and Tentative sign-ups whose deadline is within 48 hours. They're constants in `src/domain/dashboard.ts`, not settings.
