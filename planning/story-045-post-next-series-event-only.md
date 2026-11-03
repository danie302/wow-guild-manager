# Story 045: Post only the next event of a series

**Status:** Done with debt  
**Phase:** Events  
**Depends on:** [Story 021](story-021-recurring-events.md), [Story 022](story-022-discord-event-post.md), [Story 043](story-043-event-channels.md)

## Goal

Show only one upcoming event per recurring series in Discord. Today a series keeps the next 2 weeks of events, and both are posted at once. For example, a series created today that starts tomorrow posts tomorrow's event and next week's.

## Scope

- An event in a series is posted only once every earlier event in the series has finished, meaning 12 hours have passed since it started.
- The event that follows is posted as soon as the earlier one finishes.
- The event page says when an event that isn't posted yet will be posted.

## Out of scope

- Changing how many events a series keeps created ahead (still 2 weeks).
- One-time events: they're still posted as soon as they're created.

## Acceptance criteria

- [x] When a series is created, only its first event is posted. The following events are created as before, without a post.
- [x] An event in a series is posted once every earlier event in the series has finished (12 hours after it started). A cancelled earlier event counts as finished at the same time, 12 hours after the time it would have started; cancelling it doesn't post the next one sooner.
- [x] The next event is posted within a few minutes of the earlier one finishing, not only at the next hourly sweep.
- [x] An event that isn't posted yet can still be edited, cancelled, and given participants from the web app, and its post shows all of that once it's published.
- [x] Editing the series or one of its events so that the order of its events changes posts or holds back events under the same rule. An event that already has a post keeps it.
- [x] Stopping a series removes its future events without sign-ups, as before; the events that stay follow the same rule among themselves (see Technical debt).
- [x] Choosing or changing a channel (default, type, or series) only posts the events of a series that are allowed to be posted.
- [x] The event page's Discord post tab says when an event that isn't posted yet will be posted, instead of saying the post or the channel is missing.
- [x] Every new string has English and Spanish translations.

## Notes

- Decided on 2026-11-02: an event counts as finished 12 hours after it starts. A cancelled event also counts as finished 12 hours after the time it would have started, so cancelling doesn't post the next one sooner. There's no end time in the model, so the 12 hours are a fixed rule, not a setting.
- Every place that decides whether to post should share one domain rule, e.g. `isPostable(event, now)` in `src/domain/`: the event isn't in a series, or no event of its series starts earlier and finished less than 12 hours ago (cancelled ones included). Places that need it:
  - the `event-post` handler (`syncEventPost` in `src/jobs/handlers/event-posts.ts`): it doesn't create a post for an event that isn't postable yet, but keeps updating one that already exists;
  - `enqueueMissingEventPosts`, the hourly sweep, which should only pick postable events (or leave the filtering to the handler);
  - `enqueueUpcomingEventPosts` after a channel change.
- To post the next event on time, schedule a delayed job per event at `startsAt + 12h` with a fixed ID (e.g. `series-next-post-<eventId>`) that enqueues `event-post` for the next event in its series. Reschedule it when the event moves. Keep the hourly sweep as a backup.
- As built: the rule is `postTimes`/`postAt`/`postableNow` in `src/domain/series-posts.ts`. The job is `series-event-finished-<eventId>` with the series ID as payload, and it enqueues `event-post` for every upcoming unposted event of the series (the handler posts only the one that can be). Channel changes still enqueue every affected event, and the handler holds back the ones that have to wait. The API returns `discordPost.postAt`.
- Posts that already exist when this ships (e.g. next week's event of a series that's already posted) stay as they are. Deleting them could lose a post that members already signed up through.
- With weekly series, the next event is posted about 6.5 days before it starts. The missing-role alert time can be at most 72 hours ([Story 044](story-044-single-missing-role-alert.md)), so the alert always has a post to reply to. A Tentative deadline can be up to 168 hours, which can come before the post exists. Members can't sign up as Tentative before the post anyway, so nobody is affected, but the event page could point this out.

## Technical debt

- Verified with tests only (server, web, and the worker against a fake Discord). A real Discord server and the screens in a browser haven't been tried yet.
- Stopping a series deletes its future events without sign-ups, and deleted events no longer hold back the ones after them. A remaining event (one with sign-ups) can then be posted as soon as the last remaining earlier event finishes, which is sooner than if the deleted ones were still there.
- An event that started less than 12 hours ago when this ships has no `series-event-finished` job (the worker only schedules upcoming events), so the event after it is posted by the hourly search, up to an hour late.
- With a Tentative deadline of more than about 6.5 days, the deadline can come before the event is posted. Nobody can sign up as Tentative before the post, so nobody is affected, but the form doesn't warn about it.
