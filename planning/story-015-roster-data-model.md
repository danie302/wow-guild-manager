# Story 015: Roster data model

**Status:** Not started  
**Phase:** Roster  
**Depends on:** [Story 007](story-007-shared-game-data.md), [Story 012](story-012-guild-creation.md)

## Goal

Store members, characters, ranks, and officer notes.

## Scope

- Tables and typed models: members, characters, rank history, and officer notes.
- Domain functions to create members and characters, and to change ranks.

## Out of scope

- Pages and Discord commands (stories 016 and 018).

## Acceptance criteria

- [ ] A member belongs to one guild and is identified by their Discord user ID. The same Discord user can be a member of different guilds.
- [ ] A character's faction, race, class, and level are validated with the shared schema.
- [ ] A character's faction must match the guild's faction.
- [ ] Character names are unique across the whole game among active characters, enforced by a database constraint. This also keeps each character in only one guild at a time.
- [ ] Every rank change writes a rank history entry: who changed it, from, to, and when.
- [ ] Every member with characters has exactly one main character, enforced in the database. Their first character becomes the main.
- [ ] Removing a member keeps their member and character records (marked as removed) so past sign-ups and attendance stay intact. A removed member's characters don't count toward the one-guild-at-a-time constraint, so they can join another guild.
- [ ] Adding back a removed member (by hand or through an approved `/register`) restores their previous record, with their characters, rank history, officer notes, and attendance history.
- [ ] Every guild's Guild Master has a roster record: creating a guild creates it, and a migration creates it for guilds made before this story.
- [ ] Each member stores the language of their most recent interaction with the bot, used for direct messages (see Languages in `requirements.md`).

## Technical debt

None.
