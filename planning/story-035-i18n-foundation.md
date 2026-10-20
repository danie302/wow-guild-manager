# Story 035: Internationalization foundation

**Status:** Done with debt  
**Phase:** Foundation  
**Depends on:** [Story 006](story-006-web-skeleton.md), [Story 007](story-007-shared-game-data.md), [Story 008](story-008-bot-skeleton.md)

## Goal

Set up English and Spanish support in the web client, the API, and the bot, so every later story can add translated text from the start.

## Scope

- i18next with `react-i18next` in the web client, and i18next in the server (API, bot, and worker).
- English and Spanish translation files in each app.
- Move the placeholder English text from story 006 (the navigation in `app/Layout.tsx`, the page titles in `app/routes.tsx`, and `pages/StatusPage.tsx`) to the translation files.
- Typed translation keys.
- A language switcher in the web app, defaulting to the browser's language.
- Error codes in API responses, translated by the web client. Zod errors mapped to codes. The shared schemas already use codes as their custom issue messages (`CHARACTER_ERROR_CODES` in `packages/shared`).
- A helper in the bot that picks the language for each message: the interaction's locale, the member's last-used language, or the guild's language.
- Discord slash command name and description localizations.

## Out of scope

- Saving the language on the app user (story 010 adds it once users exist).
- The guild's Discord language setting (story 022).

## Acceptance criteria

- [x] The web app shows every existing text in English or Spanish, and the user can switch between them without reloading.
- [x] On first visit, the web app uses the browser's language if it's English or Spanish, and English otherwise.
- [x] Dates and numbers are formatted for the selected language with the `Intl` APIs.
- [x] Using a translation key that doesn't exist is a TypeScript error.
- [x] A test fails if the English and Spanish files don't have exactly the same keys, in every app.
- [x] API errors are returned as codes with parameters (e.g. `{ "code": "VALIDATION_ERROR", "field": "name" }`), never as translated text, and the web client shows them translated.
- [x] `/ping` replies in Spanish to a Discord user whose client is in Spanish, and in English to one whose client is in English.
- [x] Slash command names and descriptions appear in Spanish for Discord users whose client is in Spanish.
- [x] Class, race, profession, combat role, and rank names appear in English in both languages, taken from `packages/shared` by both the web client and the bot.

## Notes

- Game terms stay in English in both languages (decided). Sign-up and attendance statuses are translated.
- The language picker is on the placeholder User settings page (decided), as a radio group (`ChoiceGroup` in the UI kit). The language names are shown in their own language ("English", "Español") in both languages. The choice is kept in `localStorage` (`wgm.locale`) until story 010 saves it on the app user.
- Translation files: `apps/web/src/locales/{en,es}/translation.json` and `apps/server/src/locales/{en,es}/translation.json`, one namespace each. Keys are typed from the English file (`i18n/i18next.d.ts` in each app).
- API errors are `{ "error": { "code": … } }`. Validation errors are `{ "error": { "code": "VALIDATION_ERROR", "issues": [{ "field": "name", "code": "TOO_SHORT", "params": { "count": 2 } }] } }`, built by `toValidationIssues` in `packages/shared` (so the web client can reuse it for its own forms) and sent with `sendValidationError`. The shared schemas' rule codes pass through, with their params (the primary-profession check now sends `count`). The web client translates them with `apiErrorMessage` and `validationIssueMessage`. No route validates input yet, so the web client only shows them in tests until a form uses them.
- The bot picks the locale per interaction (`replyLocale`): the member's Discord language if it's English or Spanish, else the guild's language, else English. There's no guild language until story 022 and no stored member language until members exist, so for now unsupported Discord languages get English. `directMessageLocale` is ready for DMs.
- `/ping`'s description is localized for both Discord Spanish locales (`es-ES` and `es-419`). Its name stays `ping`.
- Dates and numbers: `useFormat()` in the web client wraps `Intl.DateTimeFormat` and `Intl.NumberFormat` for the current language. The System status page shows the last check time with it. Times use the browser's time zone until story 011.
- Game terms: nothing shows them yet. Both apps have a test that fails if a translation file has a key named after a class, race, profession, or combat role code, or a value containing one of their English names, so they can only come from `packages/shared`. Ranks aren't in `packages/shared` yet; the story that adds them should add them to these tests.
- Bot log messages (e.g. login errors) are for developers and stay in English.

## Technical debt

- **Web bundle over Vite's 500 kB warning:** 630 kB minified (198 kB gzip), up from 459 kB (147 kB gzip). About 50 kB is i18next; most of the rest is Zod, because the web client now imports a value (`SUPPORTED_LOCALES`) from `@wgm/shared`, which loads the whole package and its schemas. Zod will be needed anyway once forms validate with the shared schemas (stories 012, 015). Fix: route-based code splitting with React Router lazy routes once real pages exist, and possibly a separate vendor chunk (`manualChunks`) for longer caching. Not worth it while most pages are placeholders.
  - Update after story 011: the `ComboBox` (MUI `Autocomplete`, which pulls in `TextField` and `Popper`) added 164 kB minified (51 kB gzip), so the bundle is 780 kB (244 kB gzip). Kept on purpose: route splitting moves it out of the first load, since only settings pages use it. If that's not enough, `ComboBox` can switch to MUI's headless `useAutocomplete` hook without changing its props.
