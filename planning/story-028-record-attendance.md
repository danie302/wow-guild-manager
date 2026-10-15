# Story 028: Recording attendance

**Status:** Not started  
**Phase:** Attendance  
**Depends on:** [Story 025](story-025-manage-participants.md)

## Goal

Let the Guild Master and Officers record who attended each event.

## Scope

- An attendance form on the event page, available once the event has started.
- The six statuses: Present, Late, Left early, Bench, Absent with notice, and No-show.
- An audit log of every change.

## Acceptance criteria

- [ ] The form lists every member who signed up, including waitlisted ones.
- [ ] Cancelled events have no attendance form.
- [ ] Confirmed and Tentative participants start as Present, waitlisted characters start as Bench, and Declined sign-ups start as Absent with notice.
- [ ] The Guild Master and Officers can set and save each member's status, and mark everyone as Present at once.
- [ ] Attendance can be corrected later. After the first save, every change records who made it, the old and new status, and when. Edits before the first save aren't corrections.
- [ ] The event page shows the attendance change history.


## Technical debt

None.
