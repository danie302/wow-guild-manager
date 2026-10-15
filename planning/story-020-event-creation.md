# Story 020: Event creation

**Status:** Not started  
**Phase:** Events  
**Depends on:** [Story 011](story-011-user-time-zone.md), [Story 014](story-014-officer-access.md)

## Goal

Let the Guild Master and Officers create, edit, and cancel events in the web app.

## Scope

- An events table: type, name, description, start time (UTC), size, and slots per combat role.
- Create, edit, and cancel forms.
- The events page with Upcoming and Past, as a list and as a month calendar (screen 07 in `docs/design/`).
- The event detail page (screen 09) and the create/edit form (screen 08), with the running slot total.

## Out of scope

- Discord posts (story 022).
- Recurring events (story 021).

## Acceptance criteria

- [ ] The Guild Master and Officers can create raid, dungeon, and PvP events with a name, description, date, and time.
- [ ] Raids accept only sizes 10, 20, and 40. Tank, Healer, and DPS slots must add up to the size.
- [ ] Dungeons are always 5 players: 1 Tank, 1 Healer, and 3 DPS.
- [ ] PvP events accept any total size. Tank, Healer, and DPS slots must add up to the total.
- [ ] Times are entered in the user's time zone and stored in UTC.
- [ ] The Guild Master and Officers can edit and cancel events. Cancelling asks for confirmation. A cancelled event stays in the list and the calendar, marked as cancelled, with who cancelled it and when.
- [ ] The events page shows upcoming and past events, as a list and as a calendar.
- [ ] Reducing a role's slots below the characters already in it moves the most recent sign-ups in that role to the front of the waitlist, and they get a direct message. The form shows who will be affected before saving. (The direct message is sent once story 024 exists.)


## Technical debt

None.
