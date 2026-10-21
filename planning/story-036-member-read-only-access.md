# Story 036: Read-only access for members

**Status:** Not started  
**Phase:** Member access  
**Depends on:** [Story 014](story-014-officer-access.md), [Story 016](story-016-roster-management.md), [Story 025](story-025-manage-participants.md), [Story 029](story-029-attendance-reports.md), [Story 031](story-031-gear-check.md)

## Goal

Let roster members log into the web app to see upcoming events and the roster, without being able to change anything.

## Scope

- A third access level besides Guild Master and Officer: read-only member.
- Choosing a guild for a Discord user who is a member of more than one.
- Read-only versions of the events list and calendar, the event page, the roster, and the member's own page.
- Server-side filtering of everything members can't see.

## Acceptance criteria

- [ ] A Discord user on the roster of a guild can log in and see that guild in read-only mode.
- [ ] A Discord user in the guild's Discord server who isn't on the roster sees the no-access page.
- [ ] A member flagged as having left the Discord server can't log in.
- [ ] Members land on the events page after login.
- [ ] A member of more than one guild uses the same guild picker as Officers (story 014).
- [ ] Members see upcoming events as a list and a calendar. Past events aren't listed and can't be opened.
- [ ] On an event page, members see the description, date and time, Tentative deadline, slots per combat role, the sign-ups with combat role and status, and the waitlist. They see no actions, only a note that sign-ups happen in Discord with a link to the event's post.
- [ ] On a raid they're signed up for, members see their own gear check result, and no one else's.
- [ ] Members see the roster with Discord names, ranks, main and alt characters, professions, and attendance rates. They don't see the "left Discord" flag or any filter for it.
- [ ] Members can open only their own member page, which shows their characters and their own attendance history.
- [ ] Members can't see officer notes, rank history, pending requests to join, the attendance report, the dashboard, or the guild settings. Their navigation doesn't show those pages.
- [ ] Members can change their own time zone, language, and theme.
- [ ] Every API endpoint a member can call returns only the data listed above. Tests call each endpoint with a member session and check that hidden fields (e.g. officer notes, other people's gear results) aren't in the response.
- [ ] Every change endpoint returns 403 for a member session.

## Notes

- Design reference: the member view and guild picker in `docs/design/` (choose "member" in the prototype's Login outcome setting).

## Technical debt

None.
