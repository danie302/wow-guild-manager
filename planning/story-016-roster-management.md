# Story 016: Roster page and management

**Status:** In progress  
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

## Notes

- Built in two parts. **Part 1 (done): the API.** `GET/POST /api/guilds/:guildId/members`, `GET/PATCH/DELETE …/members/:memberId`, `POST …/characters`, `PUT …/main`, `POST …/notes`, and `GET /api/guilds/:guildId/discord-members?query=`. **Part 2: the web pages** (screens 04 and 05).
- Choosing the Discord user searches the server with Discord's member search, one REST call per query (2+ letters, cached briefly), only in the add-member form. Adding checks the user is on the server and takes their current name.
- Each row of the App permissions table that touches the roster is an action in `domain/permissions.ts`. `canChangeRankOf` and `canRemove` add the rule that Officers can only change the rank of, or remove, Raiders and Members.
- Search and filters run in the browser, since a roster is a few hundred members at most.
- The design's add-member form says "Professions (up to 2)". The requirements allow 2 primary professions plus any secondary ones, and they win.
- Officer notes can be read and added, not edited or deleted.

## Technical debt

None.
