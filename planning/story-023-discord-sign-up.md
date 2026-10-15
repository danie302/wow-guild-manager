# Story 023: Sign-up from Discord

**Status:** Not started  
**Phase:** Events  
**Depends on:** [Story 015](story-015-roster-data-model.md), [Story 022](story-022-discord-event-post.md)

## Goal

Let members sign up for events with buttons on the Discord post.

## Scope

- Tank, Healer, DPS, and Declined buttons on the post.
- Choosing a character (only those whose class can fill the chosen role) and a status (Confirmed or Tentative).
- The sign-up domain function: rank check, class check, slot or waitlist, all in one transaction that locks the event.

## Out of scope

- Promotion from the waitlist (story 024).

## Acceptance criteria

- [ ] Only roster members with an eligible rank can sign up. Members (rank) can't sign up for raids.
- [ ] A Discord user who isn't on the roster is told to use `/register`.
- [ ] The character list only shows characters whose class can fill the chosen role.
- [ ] A member can have only one character signed up per event. Changing role or character replaces their sign-up, and they lose their spot if the new role is full.
- [ ] If the role has a free slot, the character gets it. If not, they go onto the waitlist for that role.
- [ ] The member gets a reply, visible only to them, saying whether they got a slot or are on the waitlist.
- [ ] The post updates with the sign-ups for each role and the waitlist.
- [ ] A test sends 10 sign-ups at the same time for the last free slot: exactly one gets it and nine go onto the waitlist.


## Technical debt

None.
