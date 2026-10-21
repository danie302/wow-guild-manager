# Story 015: Roster data model

**Status:** Done  
**Phase:** Roster  
**Depends on:** [Story 007](story-007-shared-game-data.md), [Story 012](story-012-guild-creation.md)

## Goal

Store members, characters, ranks, and officer notes.

## Scope

- Tables and typed models: members, characters, rank history, and officer notes.
- Domain functions to create members and characters, and to change ranks.
- Characters are validated with `characterSchema` from `packages/shared`, and store its codes (`night_elf`, `first_aid`, …) as-is.

## Out of scope

- Pages and Discord commands (stories 016 and 018).

## Acceptance criteria

- [x] A member belongs to one guild and is identified by their Discord user ID. The same Discord user can be a member of different guilds.
- [x] A character's faction, race, class, and level are validated with the shared schema.
- [x] A character's faction must match the guild's faction.
- [x] Character names are unique across the whole game among active characters, enforced by a database constraint. This also keeps each character in only one guild at a time.
- [x] Every rank change writes a rank history entry: who changed it, from, to, and when.
- [x] Every member with characters has exactly one main character, enforced in the database. Their first character becomes the main.
- [x] Removing a member keeps their member and character records (marked as removed) so past sign-ups and attendance stay intact. A removed member's characters don't count toward the one-guild-at-a-time constraint, so they can join another guild.
- [x] Adding back a removed member (by hand or through an approved `/register`) restores their previous record, with their characters, rank history, officer notes, and attendance history.
- [x] Every guild's Guild Master has a roster record: creating a guild creates it, and a migration creates it for guilds made before this story.
- [x] Each member stores the language of their most recent interaction with the bot, used for direct messages (see Languages in `requirements.md`).

## Notes

- Tables: `members` (one row per Discord user and guild, removed or not), `characters`, `rank_changes`, and `officer_notes`. IDs are UUID v7.
- A member stores only their Raider or Member rank. Guild Master comes from the guild and Officer from `guild_officers` (`domain/ranks.ts`).
- The rank history records Raider/Member changes made in the app (with who made them) and, from the bot, gaining or losing the Officer role in Discord (source "discord", no user). The Guild Master gets no Officer entries.
- Removing a member sets `removed_at` on the member and their active characters with the same timestamp, which marks the characters to bring back on restore. Unique indexes only count active characters (`lower(name)`, and one main per member).
- Restoring a member whose character name was taken leaves that character removed and picks a new main (decided in this story, now in `requirements.md`).
- The bot keeps members' Discord names and avatars current (`bot/member-profiles.ts`).
- Character validation errors from `addMember` point at the character: `characters.1.race`.

## Technical debt

None.
