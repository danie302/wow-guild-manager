# Story 019: Members who leave the Discord server

**Status:** Done  
**Phase:** Roster  
**Depends on:** [Story 008](story-008-bot-skeleton.md), [Story 016](story-016-roster-management.md)

## Goal

Flag members who leave the guild's Discord server so an Officer can decide what to do.

## Scope

- The bot listens for members leaving and rejoining the server.
- A flag with the date on the roster.
- A check on bot startup for changes missed while it was offline.

## Acceptance criteria

- [x] When a member leaves the Discord server, they are flagged on the roster with the date, and their member page shows a banner saying they can't sign up for events.
- [x] The roster has a "Left Discord only" filter.
- [x] When they rejoin, the flag is cleared.
- [x] Flagged members aren't removed automatically. An Officer can remove them as usual.
- [x] Members who left while the bot was offline are flagged when it starts.

## Notes

- Decided on 2026-10-21: a pending request to join (`/register`) from someone who leaves stays, flagged "Left the Discord server", for an Officer to decide (`requirements.md` updated).
- The flag is `left_discord_at` on `members` and `registrations` (`domain/presence.ts`). Removed members are flagged too, so a restored member shows it right away.
- The bot sets it from `GuildMemberRemove` and clears it on `GuildMemberAdd`. On every connect it reads each server's member list once (over the Gateway) for both the Officers and this flag (`bot/officer-sync.ts` became `bot/server-sync.ts`). A leave found this way gets the time of the check, since the real time isn't known. A server the bot isn't in flags nobody.
- Enforcing the flag elsewhere belongs to other stories: refusing sign-ups (023), the dashboard list (034), and refusing the read-only login of flagged members (036).
- Fixed while testing: removing a member uses a timestamp later than any character removed on its own, so restoring them can't bring that character back; and "oldest character" ties are broken by ID.

## Technical debt

None.
