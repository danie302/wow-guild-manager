# Story 027: Missing-role alerts

**Status:** Done  
**Phase:** Events  
**Depends on:** [Story 009](story-009-worker-skeleton.md), [Story 024](story-024-withdraw-and-waitlist.md)

## Goal

Tell the guild in Discord when an event still needs players for a role.

## Scope

- Two checks per event, 48 hours and 24 hours before it starts, as delayed jobs with fixed IDs (rescheduled when the event's time changes, removed when it's cancelled).
- An alert message in the events channel that mentions eligible members.

## Acceptance criteria

- [x] If an event is missing players for a role 48 hours or 24 hours before it starts, the bot posts an alert such as "2 Healers still needed for BWL on Tuesday".
- [x] The alert mentions members with an eligible rank who have a character that can fill the role and haven't signed up.
- [x] No alert is posted when every role is full.
- [x] One alert per event and check, listing every role that's missing players, posted as a reply to the event's post in the guild's Discord language.
- [x] Declined members and members who left Discord aren't mentioned. Checks whose time already passed when the event was created or moved are skipped.
- [x] Moving the event reschedules both checks; cancelling removes them; a check that runs late or after a change does nothing.


## Technical debt

None.
