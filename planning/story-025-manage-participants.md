# Story 025: Managing participants from the web app

**Status:** Done  
**Phase:** Events  
**Depends on:** [Story 024](story-024-withdraw-and-waitlist.md)

## Goal

Let the Guild Master and Officers manage who is in each event.

## Scope

- Participants by role, with statuses, and the waitlist on the event page.
- Removing a participant (after confirming) and replacing a Tentative participant with a waitlisted character of the same role.
- Pre-confirming participants when the Guild Master creates a one-time raid.

## Out of scope

- Moving a waitlisted character into an open slot (open slots always go to the waitlist right away, story 024) and Undo (decided on 2026-10-21; changes ask for confirmation instead).

## Acceptance criteria

- [x] The event page shows participants by combat role with their status, and the waitlist in order.
- [x] The event page lists the characters who declined, as "Declined (N)" with their names in their class colors (as in screen 09 of `docs/design/`).
- [x] An open slot's hint names the first waitlisted character for that role, or says no one is on the waitlist.
- [x] The Guild Master and Officers can remove a participant after confirming. Their sign-up is deleted, the earliest waitlisted character of that role gets the spot, and the removed member gets a direct message saying who removed them.
- [x] The Guild Master and Officers can replace a Tentative participant with any waitlisted character of the same role, at any time before the event starts. The Tentative participant moves to the end of the waitlist, and both get a direct message. Confirmed participants can't be replaced.
- [x] The Guild Master can add Confirmed participants (a character and a role it can fill, from members who can join raids) when creating a one-time raid, within each role's slots. They get a direct message. Officers get 403, and series don't offer it.
- [x] Every change updates the Discord post.

## Technical debt

None.
