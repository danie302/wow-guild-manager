# Planning

The MVP is built in small stories, one file each. Each story has a goal, a scope, acceptance criteria, a status, and a technical debt section.

The product spec is [`requirements.md`](../requirements.md), the technology choices are in [`docs/tech-decisions.md`](../docs/tech-decisions.md), and the visual design is in [`docs/design/`](../docs/design/README.md). Its README maps each screen to the story that builds it and lists where the design differs from the requirements.

## How stories work

- Work on one story at a time, in order, unless its dependencies allow otherwise.
- A story is done when every acceptance criterion is checked and its tests pass.
- Every story that adds text people read (web pages, bot replies, direct messages, Discord posts) includes English and Spanish translations. This applies even when the story's acceptance criteria don't say so.
- Anything left unfinished, or done in a way that should be improved later, goes in the story's **Technical debt** section. If it needs its own work, create a new story for it.
- When a story's status changes, update it in the story file and in the index below.
- Assumptions and open decisions in a story's **Notes** must be resolved before or during that story.

## Statuses

| Status | Meaning |
|---|---|
| Not started | No work has begun. |
| In progress | Work has begun. |
| Blocked | Can't continue. The story's Notes say why. |
| Done | Every acceptance criterion is met and there is no technical debt. |
| Done with debt | Every acceptance criterion is met, and the Technical debt section lists what to improve later. |

## New stories

Name new files `story-NNN-short-name.md`, using the next free number, and copy the sections of an existing story. Add the story to the index.

## Index

Story 035 was added after the first plan. It belongs to the Foundation phase and must be done before story 010. Story 036 was added later and can start once its dependencies are done. Story 038 was added on 2026-10-21, after story 018. Story 039 was added on 2026-10-22, after the events stories, and story 040 the same day. Story 041 was added on 2026-10-23, story 042 on 2026-10-24, and story 043 on 2026-10-28.

### Battle.net plan

Blizzard hasn't published a Battle.net API for World of Warcraft: Forever (releasing November 5th), so the MVP goes ahead without it (decided on 2026-10-20):

- Story 017 only defines the `CharacterLookup` interface, with an "unavailable" implementation. The real Battle.net client is story 037, blocked until Blizzard publishes the API.
- Story 018 made `/register` a request to join, without a character: Officers add characters in the web app. Registering characters from Discord will be reviewed once Blizzard's API exists.
- The gear checks (031, 032) wait for story 037. The dashboard (034) can be built first without its gear section.
- Suggested order: events (020–027), attendance (028–030), then 017, 018, 038, 019, 033, and 036, and finally 037, 031, and 032 once Blizzard's API exists.

### Foundation

| Story | Title | Status | Depends on |
|---|---|---|---|
| [001](story-001-monorepo-scaffold.md) | Monorepo scaffold | Done with debt | None |
| [002](story-002-docker-dev-environment.md) | Docker development environment | Done | 001 |
| [003](story-003-testing-setup.md) | Testing setup | Done | 002 |
| [004](story-004-api-skeleton.md) | Express API skeleton and health check | Done | 003 |
| [005](story-005-sequelize-setup.md) | Database setup with Sequelize | Done | 004 |
| [006](story-006-web-skeleton.md) | Web client skeleton | Done | 004 |
| [007](story-007-shared-game-data.md) | Shared game data and schemas | Done | 003 |
| [008](story-008-bot-skeleton.md) | Discord bot skeleton | Done | 002, 003 |
| [009](story-009-worker-skeleton.md) | Worker and job queue skeleton | Done with debt | 002, 003 |
| [035](story-035-i18n-foundation.md) | Internationalization foundation | Done with debt | 006, 007, 008 |
| [040](story-040-production-deployment.md) | Production deployment | Done with debt | 002 |
| [041](story-041-cloudflare-tunnel.md) | Running on a home PC with Cloudflare Tunnel | Done with debt | 040 |

### Access and guild

| Story | Title | Status | Depends on |
|---|---|---|---|
| [010](story-010-discord-login.md) | Login with Discord | Done | 005, 006, 035 |
| [011](story-011-user-time-zone.md) | Time zone and theme settings | Done | 010 |
| [012](story-012-guild-creation.md) | Guild creation and Discord server connection | Done with debt | 007, 008, 010 |
| [013](story-013-guild-profile.md) | Guild settings page and profile | Done with debt | 012 |
| [014](story-014-officer-access.md) | Officer access from the Discord role | Done with debt | 012 |

### Roster

| Story | Title | Status | Depends on |
|---|---|---|---|
| [015](story-015-roster-data-model.md) | Roster data model | Done | 007, 012 |
| [016](story-016-roster-management.md) | Roster page and management | Done with debt | 014, 015 |
| [017](story-017-character-lookup.md) | Character lookup interface | Done | 009 |
| [018](story-018-register-command.md) | Requests to join with /register, and /main | Done | 008, 016, 017 |
| [038](story-038-edit-and-remove-characters.md) | Editing and removing characters | Done | 016, 018 |
| [019](story-019-member-left-discord.md) | Members who leave the Discord server | Done | 008, 016 |

### Events

| Story | Title | Status | Depends on |
|---|---|---|---|
| [020](story-020-event-creation.md) | Event creation | Done with debt | 011, 014 |
| [021](story-021-recurring-events.md) | Recurring events | Done | 009, 020 |
| [022](story-022-discord-event-post.md) | Event posts in Discord | Done with debt | 008, 020 |
| [023](story-023-discord-sign-up.md) | Sign-up from Discord | Done with debt | 015, 022 |
| [024](story-024-withdraw-and-waitlist.md) | Withdrawals and waitlist promotion | Done | 023 |
| [025](story-025-manage-participants.md) | Managing participants from the web app | Done | 024 |
| [026](story-026-tentative-deadline.md) | Tentative deadline and reminders | Done | 009, 024 |
| [027](story-027-missing-role-alerts.md) | Missing-role alerts | Done | 009, 024 |
| [039](story-039-add-participants.md) | Adding participants from the web app | Done | 025, 026 |
| [043](story-043-event-channels.md) | Event channels per type and per series | Done with debt | 021, 022 |

### Attendance

| Story | Title | Status | Depends on |
|---|---|---|---|
| [028](story-028-record-attendance.md) | Recording attendance | Done | 025 |
| [029](story-029-attendance-reports.md) | Attendance reports | Done | 028 |
| [030](story-030-attendance-command.md) | The /attendance command | Done | 008, 029 |
| [042](story-042-bench-counts-as-attended.md) | Bench counts as attended | Done | 029, 030 |

### Gear checks

| Story | Title | Status | Depends on |
|---|---|---|---|
| [031](story-031-gear-check.md) | Gear check | Not started | 025, 037 |
| [037](story-037-battlenet-client.md) | Battle.net API client | Blocked | 009, 017 |
| [032](story-032-automatic-gear-check.md) | Automatic gear check and direct messages | Not started | 009, 031 |

### Leadership and dashboard

| Story | Title | Status | Depends on |
|---|---|---|---|
| [033](story-033-leadership-and-disband.md) | Leadership transfer and disbanding | Done | 014, 016 |
| [034](story-034-dashboard.md) | Dashboard | Blocked | 018, 019, 024, 026, 031 |

### Member access

| Story | Title | Status | Depends on |
|---|---|---|---|
| [036](story-036-member-read-only-access.md) | Read-only access for members | Blocked | 014, 016, 025, 029, 031 |

## Not planned yet

- Production deployment and hosting.
- Everything in the **After the MVP** section of `requirements.md`.
