# Story 020: Event creation

**Status:** Done with debt  
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
- Moving sign-ups to the waitlist when a role's slots are reduced (story 024, which builds the waitlist).

## Acceptance criteria

- [x] The Guild Master and Officers can create raid, dungeon, and PvP events with a name, description, date, and time, starting in the future.
- [x] Raids accept only sizes 10, 20, and 40. Tank, Healer, and DPS slots must add up to the size.
- [x] Dungeons are always 5 players: 1 Tank, 1 Healer, and 3 DPS.
- [x] PvP events accept a total size from 1 to 80. Tank, Healer, and DPS slots must add up to the total.
- [x] Times are entered in the user's time zone and stored in UTC.
- [x] The Guild Master and Officers can edit and cancel upcoming events. The type can't change. Started and cancelled events are read-only. Cancelling asks for confirmation. A cancelled event stays in the list and the calendar, marked as cancelled, with who cancelled it and when.
- [x] The events page shows upcoming and past events, as a list and as a calendar.

## Notes

- Built in three parts: (1) the data model and API, (2) the events page with the list and the calendar, (3) the create/edit form and the event page.
- Decided on 2026-10-21:
  - Reducing a role's slots below its sign-ups (moving them to the waitlist, with a direct message and a warning in the form) moved to story 024, since sign-ups and the waitlist don't exist yet.
  - Once an event starts it's read-only: no edits or cancelling. Events can't be created in the past.
  - The type (raid, dungeon, PvP) can't change after creating the event; to change it, cancel and create another.
  - PvP events have 1 to 80 players (`requirements.md` updated).
  - Names are 1 to 100 characters, descriptions up to 2000. A cancelled event can't be reactivated.
- Part 2 (the events page): the view, the list (upcoming or past), and the calendar month are in the URL. The calendar puts each event on the day it starts in the user's time zone, and starts weeks on Sunday in English and Monday in Spanish. Event types are translated as in the design (Banda, Mazmorra, JcJ); they aren't among the game terms that stay in English. The design's per-role fill bars and "missing N" tags need sign-ups (stories 023, 024), and the "Recurring events" panel needs series (story 021); the list shows the slots per role for now. Past events show the latest 100.
- Part 3 (the form and the event page): dates and times are entered in the user's time zone and converted to UTC in the browser (`fromZonedFields` in `apps/web/src/i18n/calendar.ts`, which follows daylight saving time). Changing the type or the raid size fills in default slots (e.g. 4/10/26 for 40). The event page shows the slots per role; its Sign-ups, Gear check, and Discord post tabs come with stories 023–025, 031, and 022.
- The per-event Tentative deadline is story 026, and pre-confirmed raid participants story 025, though both appear in the design's form (screen 08).

## Technical debt

- The past events list shows only the latest 100, with no way to load older ones.
