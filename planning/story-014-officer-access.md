# Story 014: Officer access from the Discord role

**Status:** Not started  
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

- [ ] A Discord user with the guild's Officer role can log in and use the guild's pages.
- [ ] After the Officer role is removed in Discord, the user's next request is denied with 403.
- [ ] A logged-in user with no guild and no Officer role sees a page explaining they have no access, with the option to create a guild. (Story 036 later gives roster members read-only access instead.)
- [ ] The permissions module implements the rows of the App permissions table in `requirements.md` for features that exist so far, and unit tests cover each row for both the Guild Master and Officers. Every later story adds its own actions to the module, with tests.
- [ ] If a user has access to more than one guild, they choose which one to open (screen 01c in `docs/design/`) and can switch later.

## Technical debt

None.
