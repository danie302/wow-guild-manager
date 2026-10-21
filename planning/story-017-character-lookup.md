# Story 017: Character lookup interface

**Status:** Done  
**Phase:** Roster  
**Depends on:** [Story 009](story-009-worker-skeleton.md)

## Goal

Define how the app looks characters up in the game, behind an interface that works before Blizzard publishes a Battle.net API for World of Warcraft: Forever.

## Scope

- A `CharacterLookup` interface: look up a character's profile (class, race, level) and equipment, with typed results for "found", "not found", and "unavailable", and the time the data was fetched.
- An "unavailable" implementation, used until the real client exists (story 037): every lookup answers "unavailable", so callers fall back to data entered by hand.
- A fake implementation for tests.

## Out of scope

- The real Battle.net client (story 037), which waits for Blizzard's API for Forever.

## Acceptance criteria

- [x] Callers use only the `CharacterLookup` interface, so the real client can replace the "unavailable" one without changing them.
- [x] The "unavailable" implementation is used when no Battle.net credentials are configured, and the app works normally with it.
- [x] "Not found" and "unavailable" are typed results, not exceptions.
- [x] Tests use the fake implementation.

## Notes

- Split on 2026-10-20: Blizzard hasn't published a Battle.net API for Forever (releasing November 5th), so the real client moved to story 037 and the rest of the MVP goes ahead without it. See "Battle.net plan" in `planning/README.md`.

- Decided on 2026-10-20: the Battle.net environment variables wait for story 037. Until then `createCharacterLookup()` always returns the "unavailable" implementation, which is the case "no credentials configured". Nothing calls the lookup yet: story 018 is the first caller, from the worker.

## Technical debt

None.
