# Story 025: Managing participants from the web app

**Status:** Not started  
**Phase:** Events  
**Depends on:** [Story 024](story-024-withdraw-and-waitlist.md)

## Goal

Let the Guild Master and Officers manage who is in each event.

## Scope

- Participants by role, with statuses, and the waitlist on the event page.
- Removing a participant, moving a waitlisted character into an open slot, and replacing a Tentative participant.
- Pre-confirming participants when the Guild Master creates a raid.

## Acceptance criteria

- [ ] The event page shows participants by combat role with their status, and the waitlist in order.
- [ ] The event page lists the characters who declined, as "Declined (N)" with their names in their class colors (as in screen 09 of `docs/design/`).
- [ ] An open slot's hint names the first waitlisted character for that role, or says no one is on the waitlist.
- [ ] The Guild Master and Officers can remove a participant, which promotes from the waitlist.
- [ ] The Guild Master and Officers can replace a Tentative participant with a waitlisted character at any time.
- [ ] The Guild Master can add Confirmed participants when creating a raid. Officers get 403.
- [ ] A waitlisted character can be moved into an open slot with a button or by dragging.
- [ ] Removing, replacing, and moving show a message with Undo, which restores the previous state.
- [ ] Every change updates the Discord post.

## Technical debt

None.
