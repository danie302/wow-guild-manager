# Story 019: Members who leave the Discord server

**Status:** Not started  
**Phase:** Roster  
**Depends on:** [Story 008](story-008-bot-skeleton.md), [Story 016](story-016-roster-management.md)

## Goal

Flag members who leave the guild's Discord server so an Officer can decide what to do.

## Scope

- The bot listens for members leaving and rejoining the server.
- A flag with the date on the roster.
- A check on bot startup for changes missed while it was offline.

## Acceptance criteria

- [ ] When a member leaves the Discord server, they are flagged on the roster with the date, and their member page shows a banner saying they can't sign up for events.
- [ ] The roster has a "Left Discord only" filter.
- [ ] When they rejoin, the flag is cleared.
- [ ] Flagged members aren't removed automatically. An Officer can remove them as usual.
- [ ] Members who left while the bot was offline are flagged when it starts.

## Technical debt

None.
