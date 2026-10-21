# Story 022: Event posts in Discord

**Status:** Done with debt  
**Phase:** Events  
**Depends on:** [Story 008](story-008-bot-skeleton.md), [Story 020](story-020-event-creation.md)

## Goal

Publish each event in Discord and keep the post up to date.

## Scope

- A guild setting for the Discord channel where events are posted, listing only text channels where the bot can see, write, and post embeds.
- A guild setting for the language of public Discord messages (English or Spanish).
- The worker posts the event when it's created and edits the post when it changes, through `event-post` jobs (see "Event posts" in `docs/tech-decisions.md`).
- A Discord post tab on the event page that previews the bot's message (screen 09 in `docs/design/`).

## Out of scope

- Sign-up buttons (story 023).

## Acceptance criteria

- [x] The Guild Master can choose the events channel. The picker only lists text channels where the bot can see, write, and post embeds.
- [x] Events created while the guild has no events channel have no post, and the event page says the channel is missing. Choosing the channel posts every upcoming event.
- [x] Changing the events channel posts the upcoming events in the new channel and deletes their old posts.
- [x] If the bot can't post because of missing permissions, the error is stored on the event and shown in the Discord post tab. The next successful update clears it.
- [x] The Guild Master can choose the guild's Discord language, and event posts use it. Changing it updates the posts of upcoming events.
- [x] Creating an event posts it in the channel with its name, description, date and time, and slots per combat role.
- [x] The date and time use Discord timestamps, so each reader sees their local time.
- [x] The post says when Tentative sign-ups close, using the event's actual Tentative deadline.
- [x] Editing the event updates the post. Cancelling it marks the post as cancelled.
- [x] If the post was deleted in Discord, the next update posts it again.
- [x] The event page's Discord post tab shows a preview that matches the real post.

## Notes

- Bot replies and direct messages now fall back to the guild's Discord language (story 035's `guildLocale`).
- The guild has no Tentative deadline setting yet (story 026), so the post uses `tentativeDeadline()` in `src/domain/events.ts`, which is 24 hours before the event. Story 026 replaces it with the guild's setting and the event's own deadline, and the post follows.
- Sign-up buttons and the participants per role come with story 023; until then each role shows its slots as open.

## Technical debt

- The preview shows the guild's name and initials as the bot's name and avatar. The real bot's name and avatar would need a Discord call; it can be read once and stored if it matters.
- The event page doesn't refresh on its own when the worker posts the event, so the "Open in Discord" link appears after the page is reloaded or the window gets focus again.
