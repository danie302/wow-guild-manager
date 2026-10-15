# Story 007: Shared game data and schemas

**Status:** Not started  
**Phase:** Foundation  
**Depends on:** [Story 003](story-003-testing-setup.md)

## Goal

Put the game rules for characters in one place that both the browser and the server use.

## Scope

- Factions, races, classes, combat roles, and professions in `packages/shared`.
- Helpers: races for a faction, classes for a race, combat roles for a class.
- A Zod schema for character input that rejects invalid combinations.

## Out of scope

- Database tables (story 015).

## Acceptance criteria

- [ ] The races and classes table matches `requirements.md` exactly, including Dwarf Shaman, Undead Paladin, and Skyborne for each faction. A test checks every row.
- [ ] The combat roles by class table matches `requirements.md` exactly. A test checks every row.
- [ ] The character schema rejects invalid combinations (e.g. a Horde Human, a Gnome Hunter, a Warrior Healer) and accepts valid ones.
- [ ] The character schema accepts levels 1 to 60 and rejects anything else.
- [ ] The profession list is the Classic one (Alchemy, Blacksmithing, Enchanting, Engineering, Herbalism, Leatherworking, Mining, Skinning, Tailoring, Cooking, First Aid, Fishing).
- [ ] Both `apps/web` and `apps/server` import the tables and schema.


## Technical debt

None.
