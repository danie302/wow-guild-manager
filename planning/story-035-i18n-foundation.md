# Story 035: Internationalization foundation

**Status:** Not started  
**Phase:** Foundation  
**Depends on:** [Story 006](story-006-web-skeleton.md), [Story 007](story-007-shared-game-data.md), [Story 008](story-008-bot-skeleton.md)

## Goal

Set up English and Spanish support in the web client, the API, and the bot, so every later story can add translated text from the start.

## Scope

- i18next with `react-i18next` in the web client, and i18next in the server (API, bot, and worker).
- English and Spanish translation files in each app.
- Typed translation keys.
- A language switcher in the web app, defaulting to the browser's language.
- Error codes in API responses, translated by the web client. Zod errors mapped to codes.
- A helper in the bot that picks the language for each message: the interaction's locale, the member's last-used language, or the guild's language.
- Discord slash command name and description localizations.

## Out of scope

- Saving the language on the app user (story 010 adds it once users exist).
- The guild's Discord language setting (story 022).

## Acceptance criteria

- [ ] The web app shows every existing text in English or Spanish, and the user can switch between them without reloading.
- [ ] On first visit, the web app uses the browser's language if it's English or Spanish, and English otherwise.
- [ ] Dates and numbers are formatted for the selected language with the `Intl` APIs.
- [ ] Using a translation key that doesn't exist is a TypeScript error.
- [ ] A test fails if the English and Spanish files don't have exactly the same keys, in every app.
- [ ] API errors are returned as codes with parameters (e.g. `{ "code": "VALIDATION_ERROR", "field": "name" }`), never as translated text, and the web client shows them translated.
- [ ] `/ping` replies in Spanish to a Discord user whose client is in Spanish, and in English to one whose client is in English.
- [ ] Slash command names and descriptions appear in Spanish for Discord users whose client is in Spanish.
- [ ] Class, race, profession, combat role, and rank names appear in English in both languages, taken from `packages/shared` by both the web client and the bot.

## Notes

- Game terms stay in English in both languages (decided). Sign-up and attendance statuses are translated.

## Technical debt

None.
