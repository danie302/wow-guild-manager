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

Story 035 was added after the first plan. It belongs to the Foundation phase and must be done before story 010. Story 036 was added later and can start once its dependencies are done.

### Battle.net plan

Blizzard hasn't published a Battle.net API for World of Warcraft: Forever (releasing November 5th), so the MVP goes ahead without it (decided on 2026-10-20):

- Story 017 only defines the `CharacterLookup` interface, with an "unavailable" implementation. The real Battle.net client is story 037, blocked until Blizzard publishes the API.
- Story 018 (`/register`) works in manual mode until then: lookups are "unavailable", so the Officer enters the class, race, and level when approving, as for a character Battle.net can't find.
- The gear checks (031, 032) wait for story 037. The dashboard (034) can be built first without its gear section.
- Suggested order: events (020–027), attendance (028–030), then 017, 018, 019, 033, and 036, and finally 037, 031, and 032 once Blizzard's API exists.

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
| [017](story-017-character-lookup.md) | Character lookup interface | Not started | 009 |
| [018](story-018-register-command.md) | Character registration with /register | Not started | 008, 016, 017 |
| [019](story-019-member-left-discord.md) | Members who leave the Discord server | Not started | 008, 016 |

### Events

| Story | Title | Status | Depends on |
|---|---|---|---|
| [020](story-020-event-creation.md) | Event creation | Not started | 011, 014 |
| [021](story-021-recurring-events.md) | Recurring events | Not started | 009, 020 |
| [022](story-022-discord-event-post.md) | Event posts in Discord | Not started | 008, 020 |
| [023](story-023-discord-sign-up.md) | Sign-up from Discord | Not started | 015, 022 |
| [024](story-024-withdraw-and-waitlist.md) | Withdrawals and waitlist promotion | Not started | 023 |
| [025](story-025-manage-participants.md) | Managing participants from the web app | Not started | 024 |
| [026](story-026-tentative-deadline.md) | Tentative deadline and reminders | Not started | 009, 024 |
| [027](story-027-missing-role-alerts.md) | Missing-role alerts | Not started | 009, 024 |

### Attendance

| Story | Title | Status | Depends on |
|---|---|---|---|
| [028](story-028-record-attendance.md) | Recording attendance | Not started | 025 |
| [029](story-029-attendance-reports.md) | Attendance reports | Not started | 028 |
| [030](story-030-attendance-command.md) | The /attendance command | Not started | 008, 029 |

### Gear checks

| Story | Title | Status | Depends on |
|---|---|---|---|
| [031](story-031-gear-check.md) | Gear check | Not started | 025, 037 |
| [037](story-037-battlenet-client.md) | Battle.net API client | Blocked | 009, 017 |
| [032](story-032-automatic-gear-check.md) | Automatic gear check and direct messages | Not started | 009, 031 |

### Leadership and dashboard

| Story | Title | Status | Depends on |
|---|---|---|---|
| [033](story-033-leadership-and-disband.md) | Leadership transfer and disbanding | Not started | 014, 016 |
| [034](story-034-dashboard.md) | Dashboard | Not started | 018, 019, 024, 026, 031 |

### Member access

| Story | Title | Status | Depends on |
|---|---|---|---|
| [036](story-036-member-read-only-access.md) | Read-only access for members | Not started | 014, 016, 025, 029, 031 |

## Not planned yet

- Production deployment and hosting.
- Everything in the **After the MVP** section of `requirements.md`.
