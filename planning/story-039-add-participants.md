# Story 039: Adding participants from the web app

**Status:** Done  
**Phase:** Events  
**Depends on:** [Story 025](story-025-manage-participants.md), [Story 026](story-026-tentative-deadline.md)

## Goal

Let the Guild Master and Officers sign a member up for an event from the web app, so they can fix problems without waiting for the member to do it in Discord.

## Scope

- An **Add participant** action on the event page's Sign-ups tab, for events that haven't started and aren't cancelled.
- Picking a member, one of their characters, a combat role it can fill, and Confirmed or Tentative.
- Changing the sign-up of a member who already has one (in a slot, on the waitlist, or Declined).
- A direct message to the member saying who added them.

## Out of scope

- Members signing up from the web app (they still only sign up from Discord).
- Adding someone to an event that has started: that's the attendance list (story 028).

## Acceptance criteria

- [x] The Guild Master and Officers can add a participant to an upcoming event: a character of an active member who hasn't left the Discord server, whose rank can join the event, and a combat role the character's class can fill. Read-only members get 403.
- [x] They get a slot if the role has an open one, and go to the end of the role's waitlist otherwise.
- [x] The status is Confirmed or Tentative. Tentative is refused after the event's Tentative deadline, and a Tentative participant added after the reminder time gets the reminder right away.
- [x] If the member already had a sign-up, it changes as if they had changed it in Discord: the same role keeps their spot or place on the waitlist, while another role, or coming back from Declined, is a new sign-up. A slot they leave goes to that role's waitlist.
- [x] Moving someone who is signed up (in a slot or on the waitlist) to another role asks for confirmation first, saying they lose their spot in their current role.
- [x] The member gets a direct message with who added them, the event, the character, the role, the status, and whether they're in a slot or on the waitlist.
- [x] The Discord post updates.
- [x] Sign-ups from Discord and from the web app share the same rules in `domain/sign-ups.ts`, and run in one transaction that locks the event first.

## Notes

- Decided on 2026-10-22: a full role sends the character to the waitlist (no going over the slots); the Officer picks Confirmed (default) or Tentative; an existing sign-up is changed, not refused; the member gets a direct message saying who did it. Eligibility is the same as signing up from Discord. `requirements.md` updated.
- Extracting the shared sign-up logic turned up a bug from story 023: a member who left a slot for a full role kept the old slot closed (the check read the placement after updating it), so the waitlist of their old role wasn't promoted. Fixed, with a test.
- The permission table already listed "Accept, remove, or replace event participants"; adding covers the "accept" part.

## Technical debt

None.
