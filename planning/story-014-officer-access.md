# Story 014: Officer access from the Discord role

**Status:** Done with debt  
**Phase:** Access and guild  
**Depends on:** [Story 012](story-012-guild-creation.md)

## Goal

Give app access to the Guild Master and to members with the Officer role in Discord, and to no one else.

## Scope

- Working out each logged-in user's access: Guild Master, Officer, or none.
- One permissions module that maps every action to the ranks allowed to do it.
- Middleware that checks permissions on every protected route.
- The bot listens for role changes and clears cached access.

## Acceptance criteria

- [x] A Discord user with the guild's Officer role can log in and use the guild's pages.
- [x] After the Officer role is removed in Discord, the user's next request is denied with 403.
- [x] A logged-in user with no guild and no Officer role sees a page explaining they have no access, with the option to create a guild. (Story 036 later gives roster members read-only access instead.)
- [x] The permissions module implements the rows of the App permissions table in `requirements.md` for features that exist so far, and unit tests cover each row for both the Guild Master and Officers. Every later story adds its own actions to the module, with tests.
- [x] If a user has access to more than one guild, they choose which one to open (screen 01c in `docs/design/`) and can switch later.

## Notes

- Officer access is stored in `guild_officers`, which the bot keeps current from Gateway events (`bot/officer-sync.ts`) and resyncs each time it connects. The API reads only the database, so it makes no Discord API calls to check access. When a guild is created or its Officer role changes, the API reads the role's members once with REST. See "Officer access" in `docs/tech-decisions.md`.
- Every table's ID is now a UUID v7 (see "IDs: UUID v7" in `docs/tech-decisions.md`), so guild URLs can't be guessed or counted. The `users` and `guilds` migrations were rewritten, since there was no real data yet.
- Permissions are in `apps/server/src/domain/permissions.ts`, checked by `requireGuildPermission(action)` on each guild route.
- The web app has a guild's pages under `/guilds/:guildId/...`. `/` opens the user's only guild, the one they last opened, the guild picker (`/guilds`), or the no-access page (`/no-access`). The sidebar switches guild and, for users who don't lead one, offers to create a guild.
- A 403 from the API reloads the user's guild list, so a guild drops out as soon as access is lost.
- The design's no-access and picker copy names a specific server and role. Since a user without access isn't tied to one guild, the copy is generic.

## Technical debt

- While the bot is down, a removed Officer role keeps working until the bot reconnects and resyncs (an accepted trade-off).
- The bot's resync reads every connected server's member list on each connection. That's fine for a few servers; with many large ones, resync only the guilds whose events may have been missed.
