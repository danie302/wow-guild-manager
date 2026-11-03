# Story 044: One missing-role alert with a configurable time

**Status:** Done with debt  
**Phase:** Events  
**Depends on:** [Story 021](story-021-recurring-events.md), [Story 027](story-027-missing-role-alerts.md)

## Goal

Replace the two missing-role alerts (48 and 24 hours before an event) with a single alert whose time each event or recurring series can choose.

## Scope

- One missing-role check per event instead of two.
- A missing-role alert time (hours before the event) on events and recurring series: 24 hours by default, from 1 to 72.
- The field in the event form and the series form, for the Guild Master and Officers.
- A series edit passes the alert time to its future events, like the rest of its fields.

## Out of scope

- A guild-wide default alert time in the guild settings (decided on 2026-11-02: the default is a fixed 24 hours).
- Changing who is mentioned or what the alert says.

## Acceptance criteria

- [x] Each event gets at most one missing-role alert, at its alert time before it starts. No 48-hour alert is sent anymore.
- [x] Events and series have an alert time from 1 to 72 hours, 24 by default. The API rejects values outside that range with a validation error code.
- [x] The Guild Master and Officers can set the alert time when creating or editing an event, and when creating or editing a series.
- [x] Editing a series' alert time changes it for every future event of the series (cancelled events stay cancelled), and reschedules their checks.
- [x] Changing an event's time or its alert time reschedules its check; a check whose time has already passed is skipped. Cancelling the event removes it.
- [x] A check that runs late, or after the event or its alert time changed, does nothing.
- [x] Jobs already queued under the old IDs (`missing-roles-48-<eventId>`, `missing-roles-24-<eventId>`) are removed or do nothing, so no event gets an alert twice after the upgrade.
- [x] The event page shows the alert time.
- [x] Every new string has English and Spanish translations.

## Notes

- Decided on 2026-11-02: one alert, 24 hours by default, 1 to 72 hours, chosen per event and per series. There's no guild setting. 72 hours is the maximum so the alert always comes after the event's post exists, since with [Story 045](story-045-post-next-series-event-only.md) the next event of a weekly series is posted about 6.5 days before it starts.
- Data: add a `missing_role_alert_hours` column (integer, not null, default 24) to `events` and `event_series`, with a migration. Existing rows get 24.
- Jobs: `scheduleEventJobs` (`src/jobs/event-jobs.ts`) schedules one `missing-role-check` with the fixed ID `missing-roles-<eventId>`, at `startsAt - missingRoleAlertHours`. The payload becomes `{ eventId }`, and the handler (`src/jobs/handlers/missing-roles.ts`) re-reads the event and its alert time and checks that it's due. To clean up the old jobs, `scheduleEventJobs` can unschedule both old IDs; the worker already reschedules every upcoming event when it starts (`allUpcomingEventIds`). The handler should do nothing for a payload that still has `hoursBefore`.
- Update the job's description in `definitions.ts`, the missing-role alert notes in `docs/tech-decisions.md`, and the time-based jobs line in `CLAUDE.md`, which still say 48 and 24 hours.
- The dashboard's missing-roles list (`src/domain/dashboard.ts`) isn't related to the alert time and doesn't change.

## Technical debt

- Verified with tests only (server and web). The real alert in Discord and the form in a browser haven't been tried yet.
- Nothing records that an event's alert was already sent. If someone moves the alert time closer to the start after the alert went out (e.g. from 48 to 12 hours), the event gets a second alert. A `missing_role_alert_sent_at` column would prevent it.
- `removeOldMissingRoleChecks` and the handler's check for `hoursBefore` only exist for the upgrade. Once the worker has started once in production with this change, they can be removed.
