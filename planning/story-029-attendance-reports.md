# Story 029: Attendance reports

**Status:** Not started  
**Phase:** Attendance  
**Depends on:** [Story 028](story-028-record-attendance.md)

## Goal

Show each member's attendance rate and history, and compare members.

## Scope

- The attendance rate calculation.
- A member attendance page and a guild-wide comparison view.

## Acceptance criteria

- [ ] The attendance rate is attended events divided by all events the member has an attendance record for, within the chosen period: last 4 weeks, last 8 weeks (default), or all time.
- [ ] Present, Late, and Left early count as attended. Bench, Absent with notice, and No-show don't.
- [ ] Unit tests cover the calculation for every status.
- [ ] Each member's page shows their rate overall and per event type, and their history with counts of late arrivals and no-shows.
- [ ] The comparison view lists every member, can be sorted by attendance rate, and can be filtered by period and event type.
- [ ] Members are grouped into Good, Watch, and At risk bands, and the report shows how many are in each.
- [ ] The Guild Master can set the two band thresholds in the guild settings (defaults 90% and 75%). Invalid thresholds are rejected, and Officers get 403.
- [ ] The roster and each member's page show the rate for the last 8 weeks.
- [ ] Removed members aren't listed in the comparison view, and their records still count in past events.

## Technical debt

None.
