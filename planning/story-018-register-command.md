# Story 018: Requests to join with /register, and /main

**Status:** Done with debt  
**Phase:** Roster  
**Depends on:** [Story 008](story-008-bot-skeleton.md), [Story 016](story-016-roster-management.md), [Story 017](story-017-character-lookup.md)

## Goal

Let people ask to join the roster from Discord, for the Guild Master or an Officer to approve, and let members choose their main from Discord.

## Scope

- A `/register` command, without options, that sends a request to join the guild of the Discord server.
- A "Requests to join" page in the web app (screen 06), to approve or reject them.
- A direct message with the result.
- A `/main <character>` command that suggests the member's characters and makes the chosen one their main.

## Out of scope

- Adding characters from Discord. Officers add them in the web app. To be reviewed once the Battle.net API supports World of Warcraft: Forever (story 037).

## Acceptance criteria

- [x] `/register` creates a pending request to join, with the person's Discord name and avatar.
- [x] `/register` is refused, with a clear message, for someone already on the roster, someone with a request waiting, or a server without a guild.
- [x] The person gets a reply, visible only to them, saying the request is waiting for an Officer.
- [x] The Guild Master and Officers see pending requests and can approve or reject them. Rejecting asks for confirmation.
- [x] Approving adds the person as a Member without characters, or restores them with their characters if they were removed. The page links to their member page to add characters.
- [x] The person gets a direct message, in the language they used `/register` in, saying whether they were approved or rejected.
- [x] `/main` suggests the member's characters and makes the chosen one their main. It refuses characters that aren't theirs and people who aren't on the roster.

## Notes

- Built in two parts (backend, then the web page). After part 2, the scope changed (decided on 2026-10-21): `/register` was first built to register a character, looked up in Battle.net, for an Officer to approve. It became a request to join without a character, because someone who was already on the roster with characters shouldn't get a new one. Officers add characters in the web app, and members change their main with `/main`. `requirements.md` was updated.
- Other decisions (2026-10-20 and 2026-10-21):
  - Professions are optional for every character (`requirements.md` changed).
  - Rejecting has no reason, as in the design. People added by an approval get the Member rank.
  - `/main` applies right away, without approval, since it only picks among characters an Officer already added.
  - The direct message is sent by a worker job (`registration-reviewed`), so the API never calls Discord.
- The data is in `registrations` (migration `20261027120000-registrations-as-join-requests` replaced the first version's `character_registrations`).

## Technical debt

- Officers aren't told about new requests; they see them on this page (and on the dashboard, story 034). The sidebar has no count of pending requests.
- Times show as dates, not relative ("2 h ago") as in the design: `useFormat()` has no relative time yet.
