# Story 024: Withdrawals and waitlist promotion

**Status:** Not started  
**Phase:** Events  
**Depends on:** [Story 023](story-023-discord-sign-up.md)

## Goal

Free spots when someone withdraws or is removed, and fill them from the waitlist.

## Scope

- Withdrawing with the Declined button.
- Promoting the earliest waitlisted character with the same combat role.
- Removing a member's sign-ups for upcoming events when they're removed from the roster, and a character's when it's removed (story 038).

## Acceptance criteria

- [ ] Choosing Declined releases the member's spot.
- [ ] When a spot opens, the earliest waitlisted character with the same combat role gets it, and is told by direct message.
- [ ] Removing a member from the roster, or removing one of their characters, removes those sign-ups for upcoming events and promotes characters from the waitlist. Sign-ups and attendance in past events are kept.
- [ ] The post updates after every change.
- [ ] A test with simultaneous withdrawals and sign-ups never fills more slots than the event has.

## Technical debt

None.
