# Story 031: Gear check

**Status:** Not started  
**Phase:** Gear checks  
**Depends on:** [Story 037](story-037-battlenet-client.md), [Story 025](story-025-manage-participants.md)

## Goal

Let the Guild Master and Officers check participants' gear and enchants before a raid.

## Scope

- A guild setting for which slots must be enchanted.
- A **Refresh** button on raid event pages that runs the check as a background job.
- Storing and showing the results.

## Out of scope

- The automatic check and direct messages (story 032).

## Acceptance criteria

- [ ] The Guild Master and Officers can choose which slots must be enchanted.
- [ ] The check covers every character signed up as Confirmed or Tentative, and every character on the waitlist.
- [ ] For each character, the results show the item in every slot, the average item level, empty slots, and required slots without an enchant.
- [ ] The event page shows how many participants are ready and how many have problems, with the problems per character.
- [ ] Each result shows when Battle.net last updated the data.
- [ ] Characters that Battle.net can't find are flagged.
- [ ] The page stays usable while the check runs, and if Battle.net fails.

## Technical debt

None.
