# Story 042: Bench counts as attended

**Status:** Done  
**Phase:** Attendance  
**Depends on:** [Story 029](story-029-attendance-reports.md), [Story 030](story-030-attendance-command.md)

## Goal

A member who was benched was available, so being benched shouldn't lower their attendance rate. Count Bench as attended, and show how many times each member was benched.

## Scope

- Bench counts as attended in the attendance rate, everywhere it's shown (roster, member page, attendance report, bands, guild average, `/attendance`).
- A count of times benched, next to late arrivals and no-shows: on the member's attendance page, as a sortable column in the attendance report, and in the `/attendance` reply.

## Out of scope

- Changing how the attendance list is pre-filled (waitlisted characters still start as Bench).

## Acceptance criteria

- [x] Present, Late, Left early, and Bench count as attended; Absent with notice and No-show don't.
- [x] The member attendance response and each attendance report row include the number of Bench records in the period.
- [x] The member's attendance page shows the Bench count, and the attendance report has a sortable Bench column.
- [x] The `/attendance` reply shows the Bench count and lists Bench among the statuses that count as attended.

## Notes

- Decided on 2026-10-24: Bench counts as attended rather than being left out of the rate. The report helps decide who gets a spot, so being available should count, and a member benched for a whole period would otherwise have no rate at all. Bench still means the member was available: if a waitlisted member didn't show up, the GM or an Officer changes their status when recording attendance.

## Technical debt

None.
