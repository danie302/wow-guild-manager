# Story 011: Time zone and theme settings

**Status:** Done  
**Phase:** Access and guild  
**Depends on:** [Story 010](story-010-discord-login.md)

## Goal

Show every date and time in the app user's own time zone, and let them choose the dark or light theme.

## Scope

- A time zone field on app users (IANA name, e.g. `America/Bogota`).
- A settings page to change it, next to the language setting from story 010.
- One date formatting helper used by every page.
- A theme setting: dark (default) or light, saved on the app user. Both themes already exist (story 006): switch them with MUI's `useColorScheme`, wrapped by a hook in `src/components/ui`.
- Design reference: screen 13 in `docs/design/`.

## Acceptance criteria

- [x] On first login, the time zone defaults to the browser's time zone.
- [x] The user can change their time zone in settings.
- [x] Dates are stored in UTC and shown in the user's time zone across the app.
- [x] An invalid time zone name is rejected.
- [x] The app opens in the dark theme by default. Switching to light applies immediately, and the choice is saved on the app user and used on their next login, on any device.
- [x] Both themes use the color tokens from the design in `docs/design/`.

## Notes

- The language picker from story 035 is already on `/settings/user` (`UserSettingsPage`), built with the `ChoiceGroup` UI component. Build the full page around it.
- The page follows design screen 13: one row per setting (`Page.Setting`), a time zone dropdown with a live preview, and segmented buttons for language and theme. `ChoiceGroup` now renders as a segmented control (still a radio group for accessibility). The sidebar also has the design's quick theme button next to Sign out.
- Every change applies at once and is saved with `PATCH /api/me` (which now accepts any of `locale`, `timeZone`, `theme`); a "Settings saved" status confirms it.
- Time zones: the dropdown lists `Intl.supportedValuesOf('timeZone')` with each zone's current UTC offset, plus the saved zone if the list leaves it out (e.g. `UTC`). The server validates with `Intl.DateTimeFormat` (`timeZoneSchema` in `packages/shared`), stores the runtime's spelling, and answers `INVALID_TIME_ZONE` for anything else.
- First login: the login link sends the browser's time zone with the language; a new user gets it (UTC if it's missing or invalid). Existing users got `UTC` from the migration and pick theirs in settings.
- Dates: `useFormat()` (`apps/web/src/i18n/format.ts`) is the one formatting helper. It uses the logged-in user's time zone (the browser's before login) and the selected language.
- Theme: `useThemeMode()` in the UI kit wraps MUI's `useColorScheme`. The app opens dark; the saved theme is applied after login, and MUI also remembers the last theme in this browser so a reload doesn't flash dark first.
- Migrations only run when the `api` container starts, not when tsx restarts it after a file change. A login during development failed until `db:migrate` was run by hand.

## Technical debt

None.
