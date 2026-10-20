# Story 011: Time zone and theme settings

**Status:** Not started  
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

- [ ] On first login, the time zone defaults to the browser's time zone.
- [ ] The user can change their time zone in settings.
- [ ] Dates are stored in UTC and shown in the user's time zone across the app.
- [ ] An invalid time zone name is rejected.
- [ ] The app opens in the dark theme by default. Switching to light applies immediately, and the choice is saved on the app user and used on their next login, on any device.
- [ ] Both themes use the color tokens from the design in `docs/design/`.

## Notes

- The language picker from story 035 is already on `/settings/user` (`UserSettingsPage`), built with the `ChoiceGroup` UI component. Build the full page around it.

## Technical debt

None.
