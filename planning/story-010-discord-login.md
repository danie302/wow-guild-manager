# Story 010: Login with Discord

**Status:** Done  
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

- [x] Clicking **Log in with Discord** goes through Discord and returns to the app logged in, showing the user's name and avatar.
- [x] The session survives a restart of the `api` container.
- [x] Logging out destroys the session.
- [x] `GET /api/me` returns 401 when not logged in, and the web app sends the user to the login page.
- [x] A callback with a missing or wrong `state` is rejected.
- [x] The language chosen in the web app is saved on the app user and used on their next login, on any device.
- [x] Discord access tokens are never sent to the browser.
- [x] The session cookie is `httpOnly`, `sameSite=lax`, and `secure` outside development.

## Notes

- Story 035 keeps the chosen language in the browser (`localStorage` key `wgm.locale`, see `apps/web/src/i18n/index.ts`) and shows the picker on the placeholder User settings page. On first login, save that language on the new app user instead of detecting it again.
- Sessions last 30 days and every request restarts the countdown (decided). Logging out deletes the session from Redis right away.
- OAuth2 scope is only `identify`. Guild membership and the Officer role are read by the bot (story 014), not with the user's token, so the Discord access token is used once to read the profile and dropped: it's never stored, in the session or anywhere else.
- The redirect URI goes through the web app's origin (`<WEB_ORIGIN>/api/auth/discord/callback`, proxied by Vite to the API), so the session cookie belongs to the web app's origin. `WEB_ORIGIN` is set in `docker-compose.yml` from `WEB_PORT`.
- The login starts at `GET /api/auth/discord/login?locale=<lang>`, which stores a random `state` and the page's language in the session and redirects to Discord. The callback checks the state with a constant-time comparison and deletes it (so it can't be reused), starts a new session (`regenerate`, against session fixation), and redirects to `/`. Failures go back to `/login?error=cancelled|failed|not_configured`, which the login page translates.
- A new user gets the language from the login; an existing user keeps theirs, and the web app switches to it after login. Name and avatar are refreshed from Discord on every login. `PATCH /api/me` saves the language when it's changed in User settings.
- Without `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`, the API runs and the login page says login isn't set up. `SESSION_SECRET` is required; `.env.example` has a local-only value. Empty variables in `.env` now count as not set (`loadConfig`).
- CSRF: the cookie is `SameSite=Lax`, so other sites can't send it with POST/PATCH requests, and the API only parses JSON bodies. Revisit if the app ever needs cross-site requests.
- Web: `RequireAuth` guards every page except `/login`; `useMe()` is the session state. New UI kit pieces: `Button`, `Splash` (full-screen pages like login), and `AppShell.Account` (user and sign-out in the sidebar). The Spanish nav labels now match the design ("Panel", "Plantilla").
- Verified live: login with a real Discord account, name and avatar shown, session kept across an `api` restart, Redis session holding only `userId`, language saved and applied in a private window, logout.

## Technical debt

None.
