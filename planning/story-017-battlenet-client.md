# Story 017: Battle.net API client

**Status:** Not started  
**Phase:** Roster  
**Depends on:** [Story 009](story-009-worker-skeleton.md)

## Goal

Read character data from the Battle.net API reliably, behind an interface that can be swapped when World of Warcraft: Forever is supported.

## Scope

- Client credentials authentication, with the token cached until it expires.
- Character profile lookup (class, race, level) and equipment lookup.
- Response caching with the time each response was fetched.
- Handling of rate limits and server errors.

## Acceptance criteria

- [ ] The access token is fetched once and reused until it expires.
- [ ] Looking up an existing Classic character returns its class, race, and level.
- [ ] Looking up a character that doesn't exist returns a typed "not found" result, not an exception.
- [ ] Rate limit (429) and server (5xx) responses are retried with backoff. After the last retry, the caller gets a typed error.
- [ ] Responses are cached with their fetch time, and the cache duration is configurable.
- [ ] Region, namespace, and realm are configurable with environment variables.
- [ ] Tests use recorded responses and never call the real API.

## Notes

- Until the Battle.net API supports World of Warcraft: Forever, development uses the Classic API, which needs a realm. Forever has no realms, so the lookup will change.

## Technical debt

None.
