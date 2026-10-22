# Story 024: Withdrawals and waitlist promotion

**Status:** Done  
**Phase:** Events  
**Depends on:** [Story 023](story-023-discord-sign-up.md)

## Goal

Free spots when someone withdraws or is removed, and fill them from the waitlist.

## Scope

- Withdrawing with the Declined button.
- Promoting the earliest waitlisted character with the same combat role.
- Removing a member's sign-ups for upcoming events when they're removed from the roster, and a character's when it's removed (story 038).
- Promoting when a participant changes to another role, and when an event's slots for a role are increased.
- Direct messages when an event's date or time changes, one per member for a series edit.

## Acceptance criteria

- [x] Choosing Declined releases the member's spot.
- [x] When a spot opens, the earliest waitlisted character with the same combat role gets it, and is told by direct message.
- [x] Removing a member from the roster, or removing one of their characters, removes those sign-ups for upcoming events and promotes characters from the waitlist. Sign-ups and attendance in past events are kept.
- [x] Reducing a role's slots below the characters already in it moves the most recent sign-ups in that role to the front of the waitlist, and they get a direct message. The event form shows who will be affected before saving. (Moved from story 020.) The same applies when a recurring series' slots are reduced, and participants of events changed by a series edit get a direct message (moved from story 021).
- [x] A participant who changes to another role frees their old spot, and increasing a role's slots promotes from its waitlist right away.
- [x] When an event's date or time changes, its participants (slot or waitlist) get a direct message. After a series edit, each member gets one message listing all their changed events. Changing only the name or description sends none.
- [x] The post updates after every change.
- [x] A test with simultaneous withdrawals and sign-ups never fills more slots than the event has.

## Technical debt

None.
