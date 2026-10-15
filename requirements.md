# World of Warcraft Guild Manager

A tool for a guild's leadership. The Guild Master and Officers use the web app to manage the roster, events, attendance, and raid readiness. Guild members sign up for events through a Discord bot, and can log into the web app in read-only mode to see upcoming events and the roster. The guild's gold and items are managed in the game, not in the app.

## MVP scope

- Supported game version: **World of Warcraft: Forever** (releasing November 5th). It is based on Classic and adds one new race, the **Skyborne**.
- There are no realms. Characters and guilds are only separated by faction.
- The Guild Master and Officers manage the guild in the web app. Members sign up for events only through Discord, and can view upcoming events and the roster in the web app without changing anything.
- Members register their characters from Discord with `/register`, checked against the Battle.net API, and Officers can also add them by hand. Character gear is read from the Battle.net API.
- In the MVP:
  - Login with Discord, and a roster managed by Officers.
  - Read-only access for members to upcoming events and the roster.
  - Events created in the app, posted to Discord, and signed up for in Discord.
  - Attendance tracking.
  - Gear and enchant checks before raids, using the Battle.net API.
  - Discord reminders and missing-role alerts.
  - English and Spanish, in the web app and in Discord.

## Terminology

- **App user**: anyone who logs into the web app: the Guild Master and Officers, who manage the guild, and members, who have read-only access.
- **Member**: anyone on the guild's roster, including the Guild Master and Officers. Members are identified by their Discord account.
- **Rank**: a member's position in the guild: Guild Master, Officer, Raider, or Member. Ranks control app permissions (Guild Master and Officer manage, Raiders and Members read) and which events a member can join.
- **Combat role**: what a character does in a group: Tank, Healer, or DPS. Characters pick a combat role each time they sign up for an event.

## App users and login

- App users log in with Discord.
- Where each user lands after login:
  - The Guild Master and Officers go to the dashboard.
  - Members go to the upcoming events page.
  - A user with access to more than one guild (as a member or an Officer) first chooses which guild to open, and can switch later from the sidebar.
  - A Discord user who isn't on any guild's roster and doesn't have the Officer role in any guild's Discord server sees a no-access page, with the option to create a new guild.
- A user can lead only one guild at a time. After transferring leadership, they can create a new guild.
- App users set their time zone in their settings. All dates and times in the app are shown in that time zone.
- The web app has a dark and a light theme. Dark is the default, and each app user can switch in their settings.

## Languages

- The app supports **English** and **Spanish**.
- **Web app:** each app user chooses their language in their settings. On first login, it defaults to the browser's language, or English if the browser's language is neither.
- Dates, times, and numbers are formatted for the chosen language.
- **Discord:**
  - Each guild has a language for its public Discord messages (event posts and missing-role alerts), chosen by the Guild Master.
  - Replies that only one member sees (to buttons and commands) use that member's Discord language if it's English or Spanish, and the guild's language otherwise.
  - Direct messages use the language of the member's most recent interaction with the bot, or the guild's language if there is none.
  - Slash command names and descriptions are available in both languages.
- **Game terms stay in English in both languages,** as most Spanish-speaking players say them: class, race, and profession names, combat roles (Tank, Healer, DPS), and ranks (Guild Master, Officer, Raider, Member). Everything else in the interface is translated, including sign-up and attendance statuses.
- Text that people write, such as event names and descriptions or officer notes, isn't translated.

## Guilds

### Creation and leadership
- When a user creates a guild, they become its Guild Master.
- Faction is chosen when the guild is created. Only characters of the same faction can be on its roster.
- Each guild is connected to one Discord server.
- When connecting the server, the Guild Master chooses which Discord role grants the Officer rank. Members with that role are Officers in the app, and lose Officer access as soon as the role is removed in Discord.
- The Guild Master can transfer leadership to another roster member who doesn't already lead a guild. The previous Guild Master stays on the roster as a Raider.
- The Guild Master can't be removed from the roster. They must transfer leadership first.
- Being the owner of the Discord server doesn't make someone the Guild Master.
- Only the Guild Master can disband the guild.
- Disbanding deletes the guild and all of its data: roster, events, and attendance. The bot leaves the guild's Discord server.

### Guild settings
- Each guild has a name and an image.
- All guild settings are on one page. Changes apply only when saved, and unsaved changes can be discarded. Transferring leadership and disbanding are separate actions that apply right after their own confirmation.

## Roster

- The roster is managed by the Guild Master and Officers. There are no invites or join requests in the app.
- Each member has:
  - A linked Discord account
  - A rank. The Officer rank comes from the Discord role. Raider and Member are set in the app.
  - One or more characters, one of which is their **main**. The others are **alts**.
  - Private officer notes (e.g. warnings, trial status)
  - A history of rank changes
- Members register their own characters with a `/register` command in Discord. The app looks the character up in the Battle.net API to confirm it exists and fills in its class, race, and level. An Officer then approves the registration.
- If the Battle.net API can't find the character, the registration is still sent to Officers, flagged, with class, race, and level entered by hand.
- The Guild Master and Officers can also add members and characters by hand, choosing the member's Discord account from the server's members.
- A member's first character becomes their main. The Guild Master and Officers can change which character is the main. The roster shows each member's main, with a count of their alts.
- When a member leaves the guild's Discord server, they are flagged on the roster and the dashboard. An Officer decides whether to remove them. They aren't removed automatically.
- When a member is removed from the roster:
  - Their sign-ups for upcoming events are removed and their spots are released.
  - Their history is kept: past sign-ups and attendance records stay as they were, and past events still show them, marked as no longer on the roster.
  - They no longer appear on the roster or in the attendance report's member list.
  - Their characters are freed, so they can join another guild.
- If a removed member is added back to the same guild (by hand or through an approved `/register`), their previous record is restored, with their characters, rank history, officer notes, and attendance history.
- There is no limit on the number of Officers.

### Characters
- A character has a name, faction, class, race, level (1–60), and one or more professions.
- Character names are unique across the whole game, since there are no realms. No two active characters can have the same name.
- Professions are the Classic ones: Alchemy, Blacksmithing, Enchanting, Engineering, Herbalism, Leatherworking, Mining, Skinning, Tailoring, Cooking, First Aid, and Fishing.
- Faction limits which races are available, and race limits which classes are available (see below).
- A character can belong to at most one guild at a time.
- A member's characters can be in different guilds.

### Races and classes by faction

| Faction | Race | Classes |
|---|---|---|
| Alliance | Human | Warrior, Paladin, Rogue, Priest, Mage, Warlock |
| Alliance | Dwarf | Warrior, Paladin, Hunter, Rogue, Priest, Shaman |
| Alliance | Night Elf | Warrior, Hunter, Rogue, Priest, Druid |
| Alliance | Gnome | Warrior, Rogue, Mage, Warlock |
| Alliance | Skyborne | Warrior, Hunter, Rogue, Druid, Mage |
| Horde | Orc | Warrior, Hunter, Rogue, Shaman, Warlock |
| Horde | Undead | Warrior, Paladin, Rogue, Priest, Mage, Warlock |
| Horde | Tauren | Warrior, Hunter, Shaman, Druid |
| Horde | Troll | Warrior, Hunter, Rogue, Priest, Shaman, Mage |
| Horde | Skyborne | Warrior, Hunter, Rogue, Druid, Shaman |

Changes from Classic: Dwarves can be Shamans, Undead can be Paladins, and Skyborne is a new race available to both factions.

### Combat roles by class

A character can only sign up for an event with a combat role their class can fill:

| Class | Tank | Healer | DPS |
|---|:-:|:-:|:-:|
| Druid | ✓ | ✓ | ✓ |
| Hunter | | | ✓ |
| Mage | | | ✓ |
| Paladin | ✓ | ✓ | ✓ |
| Priest | | ✓ | ✓ |
| Rogue | | | ✓ |
| Shaman | | ✓ | ✓ |
| Warlock | | | ✓ |
| Warrior | ✓ | | ✓ |

## Permissions

### App permissions

| Action | Guild Master | Officer |
|---|:-:|:-:|
| Edit the guild name and image | ✓ | |
| Connect the guild's Discord server | ✓ | |
| Choose the Discord role that grants Officer | ✓ | |
| Transfer leadership | ✓ | |
| Disband the guild | ✓ | |
| Change a member's rank between Raider and Member | ✓ | ✓ |
| Remove any member from the roster | ✓ | |
| Remove Raiders and Members from the roster | ✓ | ✓ |
| Add characters and approve character registrations | ✓ | ✓ |
| Read and write officer notes | ✓ | ✓ |
| Change a member's main character | ✓ | ✓ |
| Create, edit, and cancel events | ✓ | ✓ |
| Accept, remove, or replace event participants | ✓ | ✓ |
| Pre-confirm participants when scheduling a raid | ✓ | |
| Record and edit attendance | ✓ | ✓ |
| Set the attendance band thresholds | ✓ | |
| Run and view gear checks | ✓ | ✓ |
| Configure required enchant slots | ✓ | ✓ |
| Choose the guild's events channel | ✓ | |
| Choose the guild's Discord language | ✓ | |
| Set the guild's Tentative deadline and reminder time | ✓ | ✓ |
| Set an event's own Tentative deadline | ✓ | ✓ |

### Read-only access for members

- Members on the roster can log into the web app with Discord to see their guild in read-only mode. People in the Discord server who aren't on the roster can't, and neither can members flagged as having left the Discord server.
- A Discord user who is a member of more than one guild chooses which guild to view, as described in App users and login.
- Members can see:
  - **Upcoming events**, as a list and a calendar, and each event's description, date and time, slots per combat role, who is signed up with their combat role and status, and the waitlist.
  - **Their own gear check results** for the raids they're signed up for.
  - **The roster:** each member's Discord name, rank, main and alt characters (class, race, level, professions), and attendance rate.
  - **Their own attendance history.**
  - **Their own settings:** time zone, language, and theme.
- Members can't see: officer notes, rank history, which members left the Discord server, pending character registrations, the attendance report, other participants' gear check results, past events, the dashboard, or the guild settings.
- Members can't change anything in the web app. Event pages show the Tentative deadline and remind them that sign-ups happen in Discord, with a link to the event's Discord post.
- Members can open only their own member page, not other members' pages.
- Hidden data is filtered on the server. It's never sent to a member's browser.

### Who can join events

| Event type | Guild Master | Officer | Raider | Member |
|---|:-:|:-:|:-:|:-:|
| Raid | ✓ | ✓ | ✓ | |
| Dungeon | ✓ | ✓ | ✓ | ✓ |
| PvP | ✓ | ✓ | ✓ | ✓ |

The Guild Master and Officers sign up through Discord like everyone else, including for events they created.

Officers are promoted and demoted by giving or removing the Officer role in Discord, not in the app.

## Events

### Rules for all event types
- Every event has a name, a description, and a date and time.
- The description holds details such as the instance (MC, BWL, ZG…) and requirements (minimum level, resistance gear, etc.).
- Dates and times are stored in UTC.
- Events can be one-time or recurring (e.g. "MC every Tuesday").
- Cancelling an event asks for confirmation. A cancelled event stays listed, marked as cancelled with who cancelled it and when, its sign-ups close, and its Discord post shows it as cancelled.
- If an event's slots for a combat role are reduced below the number of characters already in that role, the most recent sign-ups in that role move to the front of the waitlist and get a direct message. The form warns who will be affected before saving.

### Recurring events
- Recurrence is weekly only: the same weekday and time every week.
- The next 2 weeks of events in a series always exist. Older ones are created as time passes.
- Each event in a series can be edited or cancelled on its own.
- Editing the series (time, slots, deadline, etc.) changes every future event in it, including ones with sign-ups. Participants of changed events get a direct message, and slot reductions follow the rule above.
- Stopping a series removes its future events that have no sign-ups.

### Tentative deadline
- Each guild sets a **Tentative deadline**: how many hours before an event Tentative participants must confirm. The default is 24 hours, and it can be from 1 to 168 hours.
- Each guild also sets when the **reminder** is sent: how many hours before the deadline. The default is 12 hours, and it can be from 1 to 72 hours.
- An event can override the guild's deadline with its own, chosen when it's created or edited (e.g. 48 hours for a 40-player raid, 6 hours for a dungeon). Without an override, it uses the guild's deadline.
- Changing the guild's deadline applies to upcoming events without their own deadline, but only where the new deadline is still in the future. An event whose new deadline would already have passed keeps its previous deadline, so nobody is replaced just because a setting changed.

### Raid events
- Size: 10, 20, or 40 players.
- The number of Tank, Healer, and DPS slots is configurable. The slots must add up to the raid size.
- The Guild Master can add confirmed participants when creating the raid (not when editing it).

### Dungeon events
- Fixed size of 5 players: 1 Tank, 1 Healer, and 3 DPS.

### PvP events
- The total number of players is configurable.
- The number of Tank, Healer, and DPS slots is configurable. The slots must add up to the total.

## Discord integration

### Event posts
- When an event is created in the app, the bot posts it to a Discord channel.
- The post shows the name, description, date and time (in each reader's local time), and the slots per combat role.
- The post updates in real time with who is signed up for each role and who is on the waitlist.
- Editing or cancelling the event in the app updates the post.

### Sign-ups
- Members sign up with buttons on the post: they pick a combat role, a character, and a status.
- A member can sign up for an event with only one character. Changing role or character replaces their sign-up, and they lose their spot if the new role is full.
- Only members on the roster with an eligible rank can sign up (see [Who can join events](#who-can-join-events)).
- A character can only pick a combat role their class can fill.
- Each sign-up has a status: **Confirmed**, **Tentative**, or **Declined**.
- If every slot for the chosen combat role is taken, the character goes onto the event's **waitlist** for that role.
- The waitlist is ordered by sign-up time. When a spot opens, it goes to the earliest waitlisted character with the same combat role.
- A participant can withdraw at any time by setting their status to Declined. This releases their spot.
- In every event type, a Tentative participant who hasn't changed to Confirmed by the event's Tentative deadline is replaced by the next waitlisted character with the same combat role. If nobody is waitlisted for that role, they keep their spot.
- The Guild Master and Officers can also replace a Tentative participant with a waitlisted character manually at any time.

### Reminders and alerts
- Tentative participants get a direct message at the guild's reminder time before the Tentative deadline, reminding them to confirm. Someone who signs up as Tentative after the reminder time gets the reminder right away.
- If an event is still missing players for a combat role 48 hours and again 24 hours before it starts, the bot posts an alert (e.g. "2 Healers still needed for BWL on Tuesday") that mentions eligible members who can fill that role and haven't signed up.

## Attendance

### Recording attendance
- Once an event starts, the Guild Master or an Officer records attendance for every member who signed up, including waitlisted ones. Cancelled events have no attendance.
- The list is pre-filled from the sign-ups: Confirmed and Tentative participants start as Present, waitlisted characters start as Bench, and Declined sign-ups start as Absent with notice.
- Attendance statuses:
  - **Present**: attended the whole event.
  - **Late**: arrived after the start time.
  - **Left early**: left before the end.
  - **Bench**: was available but didn't get a spot.
  - **Absent with notice**: declined before the event.
  - **No-show**: was signed up as Confirmed or Tentative but didn't attend and didn't notify.
- Attendance can be corrected later. After it's first saved, every change records who made it, the member, the old and new status, and when. The event page shows this change history.

### Attendance rate
- The attendance rate can be shown for three periods: the **last 4 weeks**, the **last 8 weeks**, or **all time**. The last 8 weeks is the default everywhere it's shown, including the roster and each member's page.
- **Present**, **Late**, and **Left early** count as attended.
- **Bench**, **Absent with notice**, and **No-show** count as not attended.
- Attendance rate = attended events ÷ all events the member has an attendance record for, within the chosen period.

### Attendance bands
- Members are grouped by their attendance rate into three bands: **Good**, **Watch**, and **At risk**.
- The Guild Master sets the two thresholds in the guild settings. The defaults are 90% (Good at or above) and 75% (At risk below). Members in between are Watch.
- The thresholds must be between 0% and 100%, and the Good threshold must be higher than the At risk threshold.

### Attendance reports
- Each member's attendance rate, overall and per event type, for the chosen period.
- Each member's attendance history, with counts of late arrivals and no-shows.
- A guild-wide view to compare members, sortable by attendance rate and filterable by period and event type, for deciding who gets a spot when there are more interested players than slots. It shows how many members are in each band.
- Members can see their own attendance rate (for the last 8 weeks and all time) and history in Discord with an `/attendance` command. Only they see the reply.

## Gear checks (Battle.net API)

Before a raid, the app reads each participant's equipped gear from the Battle.net API so Officers can spot problems before the raid starts.

It isn't known yet whether the Battle.net API will support World of Warcraft: Forever, or how it will look up characters without realms. Until then, development and testing use the Classic API.

### When gear is checked
- Automatically, 12 hours before each raid starts.
- On demand, with a **Refresh** button on the event.
- The check covers every character signed up as Confirmed or Tentative, and every character on the waitlist.

### What the check shows
- Each character's equipped item in every slot, and their average item level.
- **Empty slots.**
- **Missing enchants:** enchantable slots with no enchant. Each guild chooses which slots must be enchanted (e.g. chest, back, wrists, hands, legs, feet, weapon).
- When the gear data was last updated. The Battle.net API only updates a character's data after they log out of the game, so it can be out of date.

### Results
- The event page shows a summary: how many participants are ready and how many have problems, with the list of problems per character.
- Characters that can't be found in the Battle.net API are flagged so an Officer can check the character name.
- After the automatic check, the bot sends a direct message to each participant with empty slots or missing enchants, listing what they need to fix before the raid.

## Dashboard

The home page for the Guild Master and Officers shows:
- Upcoming events and how full each combat role is.
- Events with missing roles.
- Tentative sign-ups close to their event's Tentative deadline.
- Participants in upcoming raids with empty slots or missing enchants.
- Pending character registrations.
- Members who left the guild's Discord server.

## After the MVP

- Combat logs: upload the game's combat log after each event, keep the original file, and analyze it:
  - Encounters: each boss attempt, with the result (kill or wipe) and duration.
  - Per player, per encounter: damage done, healing done, damage taken, and deaths.
  - Views per encounter, per player over time, and of the guild's progress.
  - Attendance filled in automatically from the log.
  - Consumable tracking (flasks, potions, etc.) per player.
- Raid composition planner (arrange groups of 5 for 40-player raids, see buffs per group, save templates).
- Loot tracking (who got which item, in which raid), and later DKP, soft-reserve, or loot council.
- Attunement and resistance gear tracking.
- Recruitment: applications through Discord, reviewed and voted on by Officers.
