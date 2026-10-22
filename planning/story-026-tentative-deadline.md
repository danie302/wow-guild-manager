# Story 026: Tentative deadline and reminders

**Status:** Done  
**Phase:** Events  
**Depends on:** [Story 009](story-009-worker-skeleton.md), [Story 024](story-024-withdraw-and-waitlist.md)

## Goal

Remind Tentative participants to confirm, and replace them with waitlisted characters if they haven't confirmed by the event's Tentative deadline.

## Scope

- Guild settings for the Tentative deadline (hours before the event) and the reminder time (hours before the deadline).
- An optional per-event deadline on the event form.
- A reminder job and a deadline job per event, with fixed job IDs.
- Rescheduling jobs when an event or the guild's settings change.

## Acceptance criteria

- [x] The Guild Master and Officers can set the guild's Tentative deadline (1–168 hours, default 24) and reminder time (1–72 hours before the deadline, default 12). Out-of-range values are rejected.
- [x] The Guild Master and Officers can give an event its own Tentative deadline, or leave it on the guild's.
- [x] Tentative participants get a direct message at the reminder time. Someone who signs up as Tentative after the reminder time gets it right away.
- [x] At the event's Tentative deadline, each Tentative participant is replaced by the earliest waitlisted character with the same combat role, and both are told by direct message.
- [x] If nobody is waitlisted for that role, the Tentative participant keeps their spot. If there are fewer waitlisted characters than Tentative participants, the most recent Tentative sign-ups are replaced first, and replaced participants move to the end of the waitlist.
- [x] After the deadline, the sign-up form only offers Confirmed.
- [x] Changing the event's time or deadline reschedules both jobs. Cancelling the event removes them.
- [x] Changing the guild's settings reschedules the jobs of upcoming events without their own deadline. An event whose new deadline would already have passed keeps its previous deadline, and nobody in it is replaced.
- [x] Rescheduling never leaves duplicate jobs: each job has a fixed ID per type and event.
- [x] A job that runs after its event was cancelled or its deadline moved does nothing. A test covers this.
- [x] The Discord post, the reminder message, and the event page show the event's actual deadline, not a fixed 24 hours (the dashboard is story 034).
- [x] The rule applies to every event type.

## Notes

- Decided: the reminder time is configurable per guild, and only the deadline can be overridden per event.
- Design reference: the Sign-ups section in Guild settings and the Tentative deadline field in the event form, in `docs/design/`.

## Technical debt

None.
