# Story 021: Recurring events

**Status:** Done  
**Phase:** Events  
**Depends on:** [Story 009](story-009-worker-skeleton.md), [Story 020](story-020-event-creation.md)

## Goal

Let the Guild Master and Officers create events that repeat, such as "MC every Tuesday".

## Scope

- A weekly recurrence option when creating an event.
- A worker job that creates upcoming instances of each series.

## Acceptance criteria

- [x] An event can be created as weekly on a chosen weekday and time. Weekly is the only recurrence. Its events keep the same UTC time every week.
- [x] The worker keeps the next 2 weeks of events in each series created.
- [x] Each instance can be edited or cancelled on its own.
- [x] Editing the series changes every future event in it, including ones with sign-ups and ones edited on their own.
- [x] The events page lists each series with its next date (screen 07 in `docs/design/`).
- [x] The whole series can be stopped, which removes its future events. (Story 023 keeps the ones with sign-ups.)

## Out of scope

- Direct messages to participants of changed events, and moving sign-ups to the waitlist when a series' slots are reduced (story 024, with the same rule for single events).

## Notes

- Built in two parts: (1) the data model, the worker job, and the API; (2) the web app.
- Decided on 2026-10-21:
  - A series keeps the same UTC time every week, so its local time moves by an hour when daylight saving time changes (`requirements.md` updated).
  - Editing the series overwrites every future event in it, including ones edited on their own. Cancelled future events stay cancelled.
  - Editing the series sets the date and time of its next event: the future events move there and every 7 days after.
- Part 2 (web): "Repeat every week" on the new event form creates a series; its page (`events/series/:seriesId`) shows when it repeats and its next event, and edits or stops it with the same form as events. The events list has a "Recurring events" section, events of a series say "Weekly", and an event's page links to its series.
- `event_series` holds the series, and its events are rows in `events` with `series_id` (a unique index on `series_id, starts_at` keeps one per week). The `extend-series` job runs every hour (and once when the worker starts) and creates events up to `SERIES_WEEKS_AHEAD` (2) weeks ahead; creating a series creates its first two weeks right away.


## Technical debt

None.
