# Story 028: Recording attendance

**Status:** Done  
**Phase:** Attendance  
**Depends on:** [Story 025](story-025-manage-participants.md)

## Goal

Let the Guild Master and Officers record who attended each event.

## Scope

- An attendance form on the event page, available once the event has started.
- The six statuses: Present, Late, Left early, Bench, Absent with notice, and No-show.
- An audit log of every change.

## Acceptance criteria

- [x] The form lists every member who signed up, including waitlisted ones.
- [x] Cancelled events have no attendance form.
- [x] Confirmed and Tentative participants start as Present, waitlisted characters start as Bench, and Declined sign-ups start as Absent with notice.
- [x] The Guild Master and Officers can set and save each member's status, and mark everyone as Present at once.
- [x] Attendance can be corrected later. After the first save, every change records who made it, the old and new status, and when. Edits before the first save aren't corrections.
- [x] The event page shows the attendance change history.
- [x] Roster members who didn't sign up can be added (with their main), and taken off again before the first save. After it, adding one is recorded in the history.


## Technical debt

None.
