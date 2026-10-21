# Story 026: Tentative deadline and reminders

**Status:** Not started  
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

- [ ] The Guild Master and Officers can set the guild's Tentative deadline (1–168 hours, default 24) and reminder time (1–72 hours before the deadline, default 12). Out-of-range values are rejected.
- [ ] The Guild Master and Officers can give an event its own Tentative deadline, or leave it on the guild's.
- [ ] Tentative participants get a direct message at the reminder time. Someone who signs up as Tentative after the reminder time gets it right away.
- [ ] At the event's Tentative deadline, each Tentative participant is replaced by the earliest waitlisted character with the same combat role, and both are told by direct message.
- [ ] If nobody is waitlisted for that role, the Tentative participant keeps their spot.
- [ ] Changing the event's time or deadline reschedules both jobs. Cancelling the event removes them.
- [ ] Changing the guild's settings reschedules the jobs of upcoming events without their own deadline. An event whose new deadline would already have passed keeps its previous deadline, and nobody in it is replaced.
- [ ] Rescheduling never leaves duplicate jobs: each job has a fixed ID per type and event.
- [ ] A job that runs after its event was cancelled or its deadline moved does nothing. A test covers this.
- [ ] The Discord post, the reminder message, and the dashboard show the event's actual deadline, not a fixed 24 hours.
- [ ] The rule applies to every event type.

## Notes

- Decided: the reminder time is configurable per guild, and only the deadline can be overridden per event.
- Story 022's Discord post shows the deadline from `tentativeDeadline()` (`apps/server/src/domain/events.ts`, 24 hours before the event). Make it use the guild's and event's deadline, and enqueue `event-post` for the affected events when the deadline settings change.
- Design reference: the Sign-ups section in Guild settings and the Tentative deadline field in the event form, in `docs/design/`.

## Technical debt

None.
