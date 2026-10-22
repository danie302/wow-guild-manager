# Story 030: The /attendance command

**Status:** Done  
**Phase:** Attendance  
**Depends on:** [Story 008](story-008-bot-skeleton.md), [Story 029](story-029-attendance-reports.md)

## Goal

Let members check their own attendance in Discord.

## Scope

- An `/attendance` command.

## Acceptance criteria

- [x] `/attendance` replies with the member's rate for the last 8 weeks and all time, per event type, and their most recent events.
- [x] Only the member who ran the command sees the reply.
- [x] A Discord user who isn't on the roster is told they have no attendance records.

## Technical debt

None.
