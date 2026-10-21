# Story 038: Editing and removing characters

**Status:** Done  
**Phase:** Roster  
**Depends on:** [Story 016](story-016-roster-management.md), [Story 018](story-018-register-command.md)

## Goal

Let the Guild Master and Officers edit and remove a member's characters in the web app, and let members remove their own characters from Discord.

## Scope

- Editing a character on the member page: name, race, class, level, and professions.
- Removing a character on the member page, after confirming.
- A `/character remove <character>` command that suggests the member's characters and asks for confirmation with buttons.
- Handling buttons in the bot (the first component interactions; story 023 reuses it for sign-ups).

## Out of scope

- Releasing the removed character's spots in upcoming events and promoting from the waitlist (story 024, as when a member is removed).
- Adding or editing characters from Discord (to be reviewed with story 037).

## Acceptance criteria

- [x] The Guild Master and Officers can edit a character's name, race, class, level, and professions, with the same rules as when adding one: race by the guild's faction, class by race, and a name no other active character has. The faction can't change.
- [x] The Guild Master and Officers can remove any character on the member page, after confirming.
- [x] A member can remove one of their own characters with `/character remove`, which suggests their characters and asks to confirm with Confirm and Cancel buttons. Only they see the replies.
- [x] Removing a character keeps its record (marked as removed), so its past sign-ups and attendance stay, and frees its name.
- [x] Removing the main makes the member's oldest remaining character the main. A member can be left without characters and stays on the roster.
- [x] Adding a character to the same member with the name of one they had removed restores its record, with the new details from the form, instead of creating a new one.
- [x] Removing a member and adding them back doesn't bring back characters that were removed on their own before.

## Notes

- Decided on 2026-10-21: Officers edit and remove characters in the web app; members remove their own from Discord with confirmation buttons; the main can be removed; every field but the faction can be edited; re-adding a removed character to the same member restores it. `requirements.md` updated.
- A character removed on its own gets a `removed_at` that differs from the member's, so restoring a removed member (which brings back the characters removed with them, by timestamp) leaves it removed.
- Button custom IDs must carry what the click needs (e.g. the character ID) and be checked again on click: only the member who ran the command can confirm, and the character must still be theirs and active.

## Technical debt

None.
