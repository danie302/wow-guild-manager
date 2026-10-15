# Story 012: Guild creation and Discord server connection

**Status:** Not started  
**Phase:** Access and guild  
**Depends on:** [Story 007](story-007-shared-game-data.md), [Story 008](story-008-bot-skeleton.md), [Story 010](story-010-discord-login.md)

## Goal

Let a user create a guild, connect it to their Discord server, and choose the Officer role.

## Scope

- A guilds table (name, faction, Discord server ID, Officer role ID, Guild Master).
- A create guild form (name and faction).
- A link to add the bot to a Discord server.
- Choosing the server and the Discord role that grants Officer.

## Out of scope

- The Guild Master's roster record (story 015 creates it for existing guilds and for every new one).
- The guild image (story 013).

## Acceptance criteria

- [ ] A logged-in user who doesn't lead a guild can create one with a name and faction, and becomes its Guild Master.
- [ ] A user who already leads a guild can't create another. The API returns 409.
- [ ] Only Discord servers where the bot is present and the Guild Master has the Manage Server permission can be selected.
- [ ] A Discord server can be connected to only one guild.
- [ ] The Guild Master chooses the Officer role from that server's roles.
- [ ] Only the Guild Master can change the server connection or the Officer role. Others get 403.
- [ ] After setup, the Guild Master lands on the dashboard.
- [ ] Setup follows screens 02 in `docs/design/` (three steps: create the guild, add the bot, choose the Officer role).

## Notes

- The design's step 3 says "Everyone with this role can use this app." Change it to say Officers can manage the guild, since members also have read-only access.

## Technical debt

None.
