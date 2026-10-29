# Story 043: Event channels per type and per series

**Status:** Done with debt  
**Phase:** Events  
**Depends on:** [Story 021](story-021-recurring-events.md), [Story 022](story-022-discord-event-post.md)

## Goal

Let a guild post different kinds of events in different Discord channels, e.g. raids in `#raids` and PvP in `#pvp`, and give a recurring series its own channel.

## Scope

- In the guild settings, the Guild Master can choose a channel for each event type (Raid, Dungeon, PvP), besides the default events channel. Each one is optional.
- When creating or editing a recurring series, the Guild Master or an Officer can choose its channel (optional).
- Each event is posted in its series' channel, else its type's channel, else the default one.
- Changing or clearing a channel at any level moves the posts of the upcoming events it affects.
- Missing-role alerts reply to the event's post in that post's channel.

## Out of scope

- A channel for a single one-time event (decided on 2026-10-28; it can be added later as a level above the series).

## Acceptance criteria

- [x] The guild settings have an optional channel for each event type, which only the Guild Master can change.
- [x] The series form has an optional channel, which the Guild Master and Officers can set.
- [x] Every channel, at every level, must be a text channel where the bot can see, write, and post embeds; the API rejects any other.
- [x] An event is posted in its series' channel if set, else its type's channel, else the default channel. An event in a series uses the series' channel even if it was edited on its own.
- [x] Changing or clearing a type's channel moves the posts of upcoming events of that type that aren't in a series with its own channel.
- [x] Changing or clearing a series' channel moves the posts of its upcoming events.
- [x] An event with no channel at any level has no post, and its page says the channel is missing; once a channel applies, it gets posted.
- [x] Missing-role alerts are posted as replies in the channel of the event's post.
- [x] Every new string has English and Spanish translations.

## Notes

- Decided on 2026-10-28: three levels (series, event type, default). The Guild Master chooses the default and per-type channels; the Guild Master or an Officer chooses a series' channel. One-time events get no channel of their own for now.
- Posts are published and moved only by the worker: after any channel change, enqueue `event-post` for the affected events, and let the handler work out the event's channel. A change of the events channel or the Discord language updates every upcoming event; a change of only some types' channels updates just the events of those types that aren't in a series with its own channel (`enqueueUpcomingEventPosts` with `types`).
- Hiding a channel from some Discord roles (e.g. `#raids` from Members, who can't join raids) is done in Discord; the app doesn't need to know.

## Technical debt

- Verified with tests only (server, web, and the worker against a fake Discord). A real Discord server and the screens in a browser haven't been tried yet.
- The event page's Discord post tab says which channel the post goes to, but not which level (series, type, or default) chose it.
