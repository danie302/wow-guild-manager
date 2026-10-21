# Story 023: Sign-up from Discord

**Status:** Done with debt  
**Phase:** Events  
**Depends on:** [Story 015](story-015-roster-data-model.md), [Story 022](story-022-discord-event-post.md)

## Goal

Let members sign up for events with buttons on the Discord post.

## Scope

- **Sign up** and **Declined** buttons on the post. Sign up opens a message only the member sees, with a character select (their main first), a combat role select (only the roles the chosen character's class can fill, updated when the character changes), and Confirmed and Tentative buttons.
- The post laid out like Raid-Helper: a header (leader, sign-up count, date, time, time left), a column per role with each character's class icon, sign-up number, and name, then the waitlist and who declined. Class and role icons are the bot application's emojis, uploaded by `pnpm discord:emojis` from images each developer adds.
- Coalesced post edits: each sign-up schedules the post's update at the end of a few-second window, with a job ID per event and window, so a burst of sign-ups makes one edit per window instead of one each (see "Event posts" in `docs/tech-decisions.md`).
- The sign-up domain function: rank check, class check (`classRoleSchema` / `rolesFor` from `packages/shared`), slot or waitlist, all in one transaction that locks the event.

## Out of scope

- Promotion from the waitlist (story 024). Until then, a spot released by Declined stays open.

## Acceptance criteria

- [x] Only roster members with an eligible rank can sign up. Members (rank) can't sign up for raids.
- [x] A Discord user who isn't on the roster is told to use `/register`.
- [x] Stopping a recurring series keeps its future events that have sign-ups (story 021 removes them all for now).
- [x] A member flagged as having left the Discord server (story 019) can't sign up.
- [x] The role list only shows the roles the chosen character's class can fill. The main is picked first, and a class with one role has it picked too.
- [x] Declined changes the member's sign-up to Declined and releases their spot. Someone who wasn't signed up gets a Declined sign-up with their main.
- [x] Sign-ups close when the event starts or is cancelled; the buttons say so.
- [x] Changing only the status, or only the character within the same role, keeps the spot or the place on the waitlist.
- [x] A burst of sign-ups for one event edits its post a few times, not once per sign-up. A test covers it.
- [x] A member can have only one character signed up per event. Changing role or character replaces their sign-up, and they lose their spot if the new role is full.
- [x] If the role has a free slot, the character gets it. If not, they go onto the waitlist for that role.
- [x] The member gets a reply, visible only to them, saying whether they got a slot or are on the waitlist.
- [x] The post updates with the sign-ups for each role and the waitlist.
- [x] The post shows class icons once they're uploaded, and plain role icons until then.
- [x] A test sends 10 sign-ups at the same time for the last free slot: exactly one gets it and nine go onto the waitlist.

## Technical debt

- Once an event starts, its post keeps the Sign up and Declined buttons; clicking them says sign-ups are closed. A job at the event's start could edit the post to remove them.
- The class icons aren't in the repository: each developer (and production) uploads their own images. Production deployment isn't planned yet.
- The character select shows at most 25 characters (Discord's limit for a select menu).
- The web app's Sign-ups tab still shows every slot open; it shows the sign-ups with story 025. The Discord post and its preview already show them.
