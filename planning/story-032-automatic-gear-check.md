# Story 032: Automatic gear check and direct messages

**Status:** Not started  
**Phase:** Gear checks  
**Depends on:** [Story 009](story-009-worker-skeleton.md), [Story 031](story-031-gear-check.md)

## Goal

Run the gear check automatically before each raid and tell players what to fix.

## Scope

- Scheduling the check 12 hours before each raid.
- Direct messages to participants with problems.

## Acceptance criteria

- [ ] The check runs automatically 12 hours before each raid.
- [ ] Changing the raid time reschedules the check. Cancelling the raid removes it. The job uses a fixed ID per event, like the Tentative jobs in story 026.
- [ ] After the check, each participant with empty slots or missing enchants gets a direct message listing what to fix.
- [ ] Participants without problems get no message.
- [ ] If a direct message can't be delivered (e.g. the member blocks direct messages), it's logged and shown on the event page.

## Technical debt

None.
