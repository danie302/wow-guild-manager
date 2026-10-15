# Story 021: Recurring events

**Status:** Not started  
**Phase:** Events  
**Depends on:** [Story 009](story-009-worker-skeleton.md), [Story 020](story-020-event-creation.md)

## Goal

Let the Guild Master and Officers create events that repeat, such as "MC every Tuesday".

## Scope

- A weekly recurrence option when creating an event.
- A worker job that creates upcoming instances of each series.

## Acceptance criteria

- [ ] An event can be created as weekly on a chosen weekday and time. Weekly is the only recurrence.
- [ ] The worker keeps the next 2 weeks of events in each series created.
- [ ] Each instance can be edited or cancelled on its own.
- [ ] Editing the series changes every future event in it, including ones with sign-ups. Participants of changed events get a direct message, and slot reductions follow the rule from story 020.
- [ ] The events page lists each series with its next date (screen 07 in `docs/design/`).
- [ ] The whole series can be stopped, which removes future instances that have no sign-ups.


## Technical debt

None.
