# Story 012: Guild creation and Discord server connection

**Status:** In progress  
**Phase:** Access and guild  
**Depends on:** [Story 007](story-007-shared-game-data.md), [Story 008](story-008-bot-skeleton.md), [Story 010](story-010-discord-login.md)

## Goal

Let a user create a guild, connect it to their Discord server, and choose the Officer role.

## Scope

- A guilds table (name, faction, Discord server ID, Officer role ID, Guild Master).
- A `DiscordDirectory` interface in the server that reads Discord data with the bot token (see "Discord data in the API" in `docs/tech-decisions.md`).
- A three-step setup: the guild's name and faction, the Discord server, and the Officer role. Nothing is saved until the last step, which creates the guild with one request. Until then the browser keeps the first step's values (sessionStorage).
- A link to add the bot to a Discord server, opened in a new tab. The server list reloads when the user comes back to the page, and has a reload button.
- A check for offensive words in the guild name (see "Offensive word filter" in `docs/tech-decisions.md`).
- A minimal dashboard page (`/dashboard`) with the guild's name, faction, and Discord server, and an empty state. Story 034 fills it in.

## Out of scope

- The Guild Master's roster record (story 015 creates it for existing guilds and for every new one).
- The guild image (story 013).
- Working out Officer access and the no-access page (story 014).

## Acceptance criteria

- [ ] A logged-in user who doesn't lead a guild can create one with a name, faction, Discord server, and Officer role, and becomes its Guild Master.
- [x] A user who already leads a guild can't create another. The API returns 409.
- [ ] The guild name is 1 to 50 characters after trimming. Names with offensive words in English or Spanish are rejected with `NAME_NOT_ALLOWED`, on the form and on the server. Words that only contain an offensive word are allowed.
- [ ] Only Discord servers where the bot is present and the user has the Manage Server (or Administrator) permission can be selected. The server checks this again when the guild is created.
- [ ] A Discord server can be connected to only one guild. Servers already connected are shown but can't be selected, and the API returns 409.
- [ ] The Guild Master chooses the Officer role from that server's roles (not `@everyone` or roles managed by integrations).
- [x] Only the Guild Master can change the server connection or the Officer role. Others get 403.
- [x] Without `DISCORD_BOT_TOKEN`, the API still runs and the setup says Discord isn't set up.
- [ ] After setup, the Guild Master lands on the dashboard.
- [ ] Setup follows screens 02 in `docs/design/` (three steps: create the guild, add the bot, choose the Officer role). Step 3 says Officers can *manage* the guild, not that everyone with the role can use the app.

## Notes

All decisions are resolved.

Built in two parts to keep each session small:
- **Part 1 (done):** the `guilds` table, `DiscordDirectory` (REST, Redis cache, and a fake for tests), the offensive word filter, and the API: `GET /api/discord/servers`, `GET /api/discord/servers/:serverId/roles`, `POST /api/guilds`, `GET /api/guilds/:guildId`, `PUT /api/guilds/:guildId/discord`, and `guilds` in `GET /api/me`. The API checks every unchecked criterion below that it can; the web side is what's left.
- **Part 2:** the three-step setup, the dashboard page, landing on it after setup and login, and the "Discord isn't set up" message on the setup.

## Technical debt

- Listing the servers reads every server the bot is in, plus the user's membership in each (cached for 60 seconds). That's fine for a bot in a few servers, but it grows with the number of servers. If the bot ends up in many, keep a list of servers and members from the bot's Gateway events instead.
- Cached Discord data can be up to 60 seconds old (e.g. a role created in Discord a moment ago). Story 014 can clear the cache from the bot's role events.
