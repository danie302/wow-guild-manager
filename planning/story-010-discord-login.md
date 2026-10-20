# Story 010: Login with Discord

**Status:** Not started  
**Phase:** Access and guild  
**Depends on:** [Story 005](story-005-sequelize-setup.md), [Story 006](story-006-web-skeleton.md), [Story 035](story-035-i18n-foundation.md)

## Goal

Let the Guild Master and Officers log in to the web app with their Discord account.

## Scope

- Discord OAuth2 login and callback in Express, with a `state` check.
- An app users table (Discord user ID, name, avatar, language).
- Sessions with `express-session` stored in Redis.
- `GET /api/me`, logout, a login page, and a route guard in the web app.

## Out of scope

- Checking guild access (story 014). In this story, any Discord user can log in.

## Acceptance criteria

- [ ] Clicking **Log in with Discord** goes through Discord and returns to the app logged in, showing the user's name and avatar.
- [ ] The session survives a restart of the `api` container.
- [ ] Logging out destroys the session.
- [ ] `GET /api/me` returns 401 when not logged in, and the web app sends the user to the login page.
- [ ] A callback with a missing or wrong `state` is rejected.
- [ ] The language chosen in the web app is saved on the app user and used on their next login, on any device.
- [ ] Discord access tokens are never sent to the browser.
- [ ] The session cookie is `httpOnly`, `sameSite=lax`, and `secure` outside development.

## Notes

- Story 035 keeps the chosen language in the browser (`localStorage` key `wgm.locale`, see `apps/web/src/i18n/index.ts`) and shows the picker on the placeholder User settings page. On first login, save that language on the new app user instead of detecting it again.

## Technical debt

None.
