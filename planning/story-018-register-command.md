# Story 018: Character registration with /register

**Status:** In progress  
**Phase:** Roster  
**Depends on:** [Story 008](story-008-bot-skeleton.md), [Story 016](story-016-roster-management.md), [Story 017](story-017-character-lookup.md)

## Goal

Let members register their own characters from Discord, for an Officer to approve.

## Scope

- A `/register` command that takes a character name.
- Looking the character up through `CharacterLookup` (story 017). Until the real Battle.net client exists (story 037), every lookup is "unavailable", so registrations are flagged and the Officer enters the class, race, and level.
- A pending registrations list in the web app.
- Approving or rejecting registrations.

## Acceptance criteria

- [x] `/register` looks the character up and creates a pending registration with its class, race, and level.
- [ ] If Battle.net can't find the character, the registration is still created and flagged. The Officer enters the class, race, and level by hand when approving.
- [x] The member gets a reply, visible only to them, saying the registration is waiting for approval.
- [x] A character of the wrong faction, or already in another guild, is rejected with a clear message.
- [ ] The Guild Master and Officers see pending registrations and can approve or reject them.
- [x] Approving creates the member (if new, or restores them if they were removed) and the character. The member is notified by direct message of the approval or rejection.

## Notes

- Built in two parts: part 1 is the data model, `/register`, the worker jobs (lookup and direct messages), and the API; part 2 is the pending registrations page (screen 06) in the web app.
- Decided on 2026-10-20:
  - The lookup runs in a worker job (`registration-lookup`), not in the bot interaction. `/register` answers right away. A character of the wrong faction is rejected by that job and the member gets a direct message.
  - Professions are optional for every character (`requirements.md` changed), since neither `/register` nor Battle.net provide them. The Officer can pick them when approving.
  - A name can have only one pending registration per guild. A character already on this guild's roster, or in another guild, is refused by `/register` right away.
  - Rejecting has no reason, as in the design. Members added by an approval get the Member rank.
- Screen 06 has class and race fields for characters not found in Battle.net, but no level field. Part 2 adds one, because a character needs a level.
- Until story 037, the lookup is always "unavailable", which follows the same path as a character Battle.net can't find. Once story 037 is done, found characters get their class, race, and level filled in with no change here.

## Technical debt

None.
