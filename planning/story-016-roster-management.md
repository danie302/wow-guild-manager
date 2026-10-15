# Story 016: Roster page and management

**Status:** Not started  
**Phase:** Roster  
**Depends on:** [Story 014](story-014-officer-access.md), [Story 015](story-015-roster-data-model.md)

## Goal

Let the Guild Master and Officers see and manage the roster in the web app.

## Scope

- A roster page listing members with their Discord name, rank, and characters (class, race, level, professions).
- Adding a member and characters by hand, choosing the Discord user from the server's members.
- Changing a member's rank between Raider and Member.
- Removing members from the roster.
- Officer notes and rank history on each member's page.

## Acceptance criteria

- [ ] The roster shows every member and their characters, following screens 04 and 05 in `docs/design/`.
- [ ] The roster can be searched by Discord name or character name, and filtered by rank and class.
- [ ] The Guild Master and Officers can add a member and characters by hand. Invalid characters are rejected with a clear message.
- [ ] The Guild Master and Officers can change a member's rank between Raider and Member, and the change appears in the rank history.
- [ ] The Guild Master can remove any member except themselves. Officers can remove only Raiders and Members, and get 403 otherwise.
- [ ] The Guild Master and Officers can read and add officer notes. Members never see them.
- [ ] Each member's page shows their rank history.
- [ ] Removed members disappear from the roster, but past events still show them, marked as no longer on the roster.
- [ ] The roster shows each member's main character with a count of their alts.
- [ ] The Guild Master and Officers can change a member's main character.

## Technical debt

None.
