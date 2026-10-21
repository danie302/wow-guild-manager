# Story 037: Battle.net API client

**Status:** Blocked  
**Phase:** Gear checks  
**Depends on:** [Story 009](story-009-worker-skeleton.md), [Story 017](story-017-character-lookup.md)

## Goal

Read character data from the Battle.net API reliably, as the real implementation of the `CharacterLookup` interface from story 017.

## Scope

- Client credentials authentication, with the token cached until it expires.
- Character profile lookup (class, race, level) and equipment lookup.
- Response caching with the time each response was fetched.
- Handling of rate limits and server errors.

## Acceptance criteria

- [ ] The access token is fetched once and reused until it expires.
- [ ] Looking up an existing character returns its class, race, and level.
- [ ] Looking up a character that doesn't exist returns a typed "not found" result, not an exception.
- [ ] Rate limit (429) and server (5xx) responses are retried with backoff. After the last retry, the caller gets a typed error.
- [ ] Responses are cached with their fetch time, and the cache duration is configurable.
- [ ] Region, namespace, and (if the API needs one) realm are configurable with environment variables.
- [ ] Tests use recorded responses and never call the real API.

## Notes

- **Blocked:** World of Warcraft: Forever releases on November 5th, and Blizzard hasn't published a Battle.net API for it yet. It isn't known whether the API will support Forever, or how it will look up characters without realms (the Classic API needs a realm). Start this story once Blizzard publishes the API. Until then, the app uses the "unavailable" implementation from story 017, and `/register` works with characters entered by hand.
- Once this story is done, review registering characters from Discord, checked against Battle.net (dropped from `/register` in story 018; see `requirements.md`).
- Split from story 017 on 2026-10-20, so the rest of the MVP doesn't wait for Blizzard.

## Technical debt

None.
