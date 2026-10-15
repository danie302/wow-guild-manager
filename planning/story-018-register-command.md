# Story 018: Character registration with /register

**Status:** Not started  
**Phase:** Roster  
**Depends on:** [Story 008](story-008-bot-skeleton.md), [Story 016](story-016-roster-management.md), [Story 017](story-017-battlenet-client.md)

## Goal

Let members register their own characters from Discord, for an Officer to approve.

## Scope

- A `/register` command that takes a character name.
- Looking the character up in the Battle.net API.
- A pending registrations list in the web app.
- Approving or rejecting registrations.

## Acceptance criteria

- [ ] `/register` looks the character up and creates a pending registration with its class, race, and level.
- [ ] If Battle.net can't find the character, the registration is still created and flagged. The Officer enters the class, race, and level by hand when approving.
- [ ] The member gets a reply, visible only to them, saying the registration is waiting for approval.
- [ ] A character of the wrong faction, or already in another guild, is rejected with a clear message.
- [ ] The Guild Master and Officers see pending registrations and can approve or reject them.
- [ ] Approving creates the member (if new, or restores them if they were removed) and the character. The member is notified by direct message of the approval or rejection.

## Notes

- The design's pending registrations screen (06) has class and race fields for characters not found in Battle.net, but no level field. Add one, because a character needs a level.

## Technical debt

None.
