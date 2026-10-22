# Design reference

The visual design for the web app, made in Claude Design. Last downloaded on 2026-10-14, after several rounds that brought it in line with `requirements.md`. It's a clickable prototype with sample data, used as the visual reference when building the web client. It isn't production code.

- `Guild Manager.dc.html`: the prototype. The interactive version is in the Claude Design project.
- `support.js`: the Claude Design runtime the prototype needs. It's generated and isn't part of the design.
- `_ds/modernist-…/`: the "Modernist" design system the prototype was built on (`readme.md`, `styles.css`).

**`requirements.md` wins over the design.** Where they disagree, follow the requirements. Known differences are listed below.

## Screens

| # | Screen | Built in story |
|---|---|---|
| 01 | Login | 010 |
| 01b | No access (not on any roster and no Officer role) | 014, 036 |
| 01c | Guild picker (for members of more than one guild, plus a switcher in the sidebar) | 036 |
| 02 | Guild setup (create guild, add bot, choose Officer role) | 012 |
| 03 | Dashboard | 034 |
| 04 | Roster (filters by rank and class, "left Discord" filter, add member, main and alts) | 016 |
| 05 | Member detail (characters with Make main, rank, rank history, officer notes, attendance by event type, remove from roster) | 016, 029 |
| 06 | Pending registrations (found / not found in Battle.net), built as requests to join | 018 |
| 07 | Events (list and calendar, recurring series) | 020, 021 |
| 08 | Create/edit event (running slot total, pre-confirmed raid participants, own Tentative deadline) | 020, 021, 025, 026 |
| 09 | Event detail: Sign-ups tab (by role, waitlist, remove, replace, move to slot, cancel event) | 020, 025, 039 |
| 09 | Event detail: Gear check tab (refresh, not found in Battle.net, full equipment per character) | 031 |
| 10 | Event detail: Attendance tab (with change history) | 028 |
| 09 | Event detail: Discord post tab (preview of the bot's message) | 022 |
| 11 | Attendance report (filter by event type) | 029 |
| 12 | Guild settings (name, image, Discord server, Officer role, events channel, Discord language, sign-ups deadline and reminder, attendance bands, enchant slots, danger zone; one Save for the page) | 012, 013, 022, 026, 029, 031, 033 |
| 13 | User settings (time zone, language, theme) | 011, 035 |
| — | Member view: the read-only versions of Events, Event detail (with "Your gear check"), Roster, and the member's own page. Pick "member" in the prototype's Login outcome setting. | 036 |

Shared patterns: a confirmation dialog for picking someone from the waitlist. The design's toast with **Undo** and its **Move to slot** button aren't built (see below).

To see each kind of user in the prototype, change **Login outcome** (officer, gm, member, new-guild, no-role) in Claude Design's Tweaks panel, then sign out and log in again.

## Visual language

The tokens below are implemented in `apps/web/src/components/ui/tokens.ts` (story 006). If the design's tokens change, update that file.

- **Typeface:** Archivo (Google Fonts), weights 400–800. Numbers use tabular figures.
- **Themes:** dark (default) and light, switched with `data-theme` on the root element.
- **Shape:** square corners, flat surfaces, 2px dividers under headers, 1px lines between rows. No shadows except dialogs and toasts.
- **Color tokens** (defined for both themes at the top of the prototype's `<style>`):
  - Surfaces and text: `--bg`, `--sf`, `--sf2`, `--tx`, `--mt` (muted), `--dv` (divider), `--ln` (line).
  - Accent (warm gold): `--ac`, `--ac-h` (hover), `--ac-on` (text on accent), `--ac-ink` (accent text), `--ac-bg`.
  - Combat roles: `--tank` (blue), `--heal` (green), `--dps` (red), each with a `-bg` tint. Used everywhere a role appears.
  - Status: `--ok`, `--warn`, `--bad`, each with a `-bg` tint.
  - Classes: `--c-druid`, `--c-hunter`, `--c-mage`, `--c-paladin`, `--c-priest`, `--c-rogue`, `--c-warlock`, `--c-warrior`, `--c-shaman`. Character names are shown in their class color.
- **Attendance status colors:** Present = ok, Late and Left early = warn, Bench and Absent with notice = muted, No-show = bad.

## Differences from the requirements

- **Event detail, Discord post tab (09)** shows Tank, Healer, DPS, Tentative, and Declined buttons on the post. The app has **Sign up** and **Declined** buttons instead: Sign up opens a message only the member sees, with a character select, a combat role select, and Confirmed and Tentative buttons (story 023, decided on 2026-10-21).
- **Event detail, Sign-ups tab (09)** has **Move to slot** (and dragging) and a toast with **Undo** after removing, replacing, or promoting. The app has neither: open slots always go to the waitlist right away (story 024), and removing asks for confirmation instead of offering Undo. Replacing works only on Tentative participants (story 025, decided on 2026-10-21). The app adds an **Add participant** button and dialog (member, character, role, status), which the design doesn't have (story 039, decided on 2026-10-22).
- **The event post's layout (09)** lists each role as numbered lines ("1. Name"). The app lays it out like Raid-Helper instead: a header with the leader, sign-up count, date, time, and time left, then a column per role with class icons, sign-up numbers across the event, and names (story 023, decided on 2026-10-21).

### Notes for implementation
- **Buttons and inputs have rounded corners (6px)**, unlike the prototype's square ones (decided on 2026-10-21): buttons, segmented controls, filter chips, the − / + steppers, text fields, dropdowns and their menus, and searchable lists. It's `controlRadius` in `src/components/ui/tokens.ts`. Cards, panels, tags, and notices stay square.
- **Guild and Discord server images are round** (decided on 2026-10-22), unlike the prototype's square ones: in the sidebar, the guild settings image picker, and the server list. So are the initials shown when there's no image.
- **The sample data is partial.** It has no Shaman class and only Alliance races, and the second guild in the picker (Emberwatch) shows Ashen Vanguard's data. Use the full tables from `packages/shared` and real data.
- **Item names are invented**, and attendance per event type is sample data.
- **Guild setup step 3 says "Everyone with this role can use this app."** Since members also have read-only access, the copy should say Officers can *manage* the guild (story 012).
- **No access (01b) and guild picker (01c)** name a specific Discord channel and role. The app uses generic copy, since a user without access isn't tied to one guild (story 014).
- **Guild settings (12)** names the Discord server's owner. The app says instead that owning the server doesn't make someone the Guild Master, without reading the owner's name (story 013).
- **Guild setup step 2** shows one server after adding the bot. The app instead lists every server where the bot is and the user can manage the server, and opens the bot invite in a new tab (story 012).
- **Pending registrations (06)** shows characters registered with /register, found or not in Battle.net, with class and race fields. In the app, /register is a request to join without a character (story 018, `requirements.md`): the page keeps the name "Pending registrations", approving is one click, and Officers add characters on the member page. It asks before rejecting, since the person gets a direct message.
- **Transferring leadership** keeps the old Guild Master on the roster as a Raider, and **disbanding** makes the bot leave the Discord server without deleting the event posts (confirmed on 2026-10-22, story 033).
