# Story 033: Leadership transfer and disbanding

**Status:** Done  
**Phase:** Leadership and dashboard  
**Depends on:** [Story 014](story-014-officer-access.md), [Story 016](story-016-roster-management.md)

## Goal

Let the Guild Master hand over the guild or disband it.

## Scope

- Transferring leadership to another member.
- Disbanding the guild.

## Acceptance criteria

- [x] The Guild Master can transfer leadership to another roster member who doesn't already lead a guild.
- [x] After the transfer, the new Guild Master has full access, the old one stays on the roster as a Raider, and they can create a new guild.
- [x] The Guild Master can't leave the roster until leadership is transferred.
- [x] Both actions are in the Danger zone of the guild settings (screen 12 in `docs/design/`) and apply right after their confirmation, without the page's Save button.
- [x] Disbanding requires typing the guild name to confirm.
- [x] Disbanding deletes the guild and all of its data: roster, events, and attendance, and the bot leaves the guild's Discord server. The event posts in its channel stay.
- [x] The transfer list marks members who already lead another guild, and both rank changes go in the rank history.
- [x] Only the Guild Master can transfer leadership or disband. Officers get 403.


## Technical debt

None.
