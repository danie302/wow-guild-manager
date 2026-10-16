# Story 007: Shared game data and schemas

**Status:** Done  
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

- [x] The races and classes table matches `requirements.md` exactly, including Dwarf Shaman, Undead Paladin, and Skyborne for each faction. A test checks every row.
- [x] The combat roles by class table matches `requirements.md` exactly. A test checks every row.
- [x] The character schema rejects invalid combinations (e.g. a Horde Human, a Gnome Hunter, a Warrior Healer) and accepts valid ones.
- [x] The character schema accepts levels 1 to 60 and rejects anything else.
- [x] The profession list is the Classic one (Alchemy, Blacksmithing, Enchanting, Engineering, Herbalism, Leatherworking, Mining, Skinning, Tailoring, Cooking, First Aid, Fishing).
- [x] Both `apps/web` and `apps/server` import the tables and schema.

## Notes

- Values are stable snake_case codes (`night_elf`, `first_aid`, `dps`), stored in the database and sent by the API. The English display names (`RACE_NAMES`, `CLASS_NAMES`, …) live next to them.
- Skyborne is one race in both factions with different classes, so `classesFor(faction, race)` takes the faction too.
- A character has no combat role: it picks one on each sign-up (`requirements.md`). So `characterSchema` checks faction, race, class, level, name, and professions, and a separate `classRoleSchema` rejects combinations like a Warrior Healer. Story 023 uses it.
- Decided in this story and added to `requirements.md`: a name only has to be non-empty (it's trimmed), and a character has at least one profession, none repeated, with at most 2 primary ones.
- The game-rule checks report error codes as the Zod issue message (`RACE_NOT_IN_FACTION`, `CLASS_NOT_FOR_RACE`, `DUPLICATE_PROFESSION`, `TOO_MANY_PRIMARY_PROFESSIONS`, `CLASS_CANNOT_FILL_ROLE`), so story 035 can return and translate them.
- The tests copy the two tables from `requirements.md` row by row. If the tables change, update both.

## Technical debt

None.
