# Story 027: Missing-role alerts

**Status:** Not started  
**Phase:** Events  
**Depends on:** [Story 009](story-009-worker-skeleton.md), [Story 024](story-024-withdraw-and-waitlist.md)

## Goal

Tell the guild in Discord when an event still needs players for a role.

## Scope

- Two checks per event, 48 hours and 24 hours before it starts, as delayed jobs with fixed IDs (rescheduled when the event's time changes, removed when it's cancelled).
- An alert message in the events channel that mentions eligible members.

## Acceptance criteria

- [ ] If an event is missing players for a role 48 hours or 24 hours before it starts, the bot posts an alert such as "2 Healers still needed for BWL on Tuesday".
- [ ] The alert mentions members with an eligible rank who have a character that can fill the role and haven't signed up.
- [ ] No alert is posted when every role is full.


## Technical debt

None.
