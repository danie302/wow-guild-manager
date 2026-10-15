# Story 022: Event posts in Discord

**Status:** Not started  
**Phase:** Events  
**Depends on:** [Story 008](story-008-bot-skeleton.md), [Story 020](story-020-event-creation.md)

## Goal

Publish each event in Discord and keep the post up to date.

## Scope

- A guild setting for the Discord channel where events are posted.
- A guild setting for the language of public Discord messages (English or Spanish).
- The bot posts the event when it's created and edits the post when it changes.
- A Discord post tab on the event page that previews the bot's message (screen 09 in `docs/design/`).

## Out of scope

- Sign-up buttons (story 023).

## Acceptance criteria

- [ ] The Guild Master can choose the events channel.
- [ ] The Guild Master can choose the guild's Discord language, and event posts use it. Changing it updates the posts of upcoming events.
- [ ] Creating an event posts it in the channel with its name, description, date and time, and slots per combat role.
- [ ] The date and time use Discord timestamps, so each reader sees their local time.
- [ ] The post says when Tentative sign-ups close, using the event's actual Tentative deadline.
- [ ] Editing the event updates the post. Cancelling it marks the post as cancelled.
- [ ] If the post was deleted in Discord, the next update posts it again.
- [ ] The event page's Discord post tab shows a preview that matches the real post.

## Technical debt

None.
