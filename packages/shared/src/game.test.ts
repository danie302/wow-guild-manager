import { describe, expect, it } from 'vitest';

import {
  CLASS_NAMES,
  classesFor,
  CLASSES,
  COMBAT_ROLE_NAMES,
  FACTION_NAMES,
  FACTIONS,
  PROFESSION_NAMES,
  PROFESSIONS,
  RACE_NAMES,
  racesFor,
  rolesFor,
} from './game.js';

// Copied from requirements.md, "Races and classes by faction". Keep the two in sync.
const RACES_AND_CLASSES = `
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
`;

// Copied from requirements.md, "Combat roles by class". Columns: Tank, Healer, DPS.
const ROLES_BY_CLASS = `
| Druid | ✓ | ✓ | ✓ |
| Hunter | | | ✓ |
| Mage | | | ✓ |
| Paladin | ✓ | ✓ | ✓ |
| Priest | | ✓ | ✓ |
| Rogue | | | ✓ |
| Shaman | | ✓ | ✓ |
| Warlock | | | ✓ |
| Warrior | ✓ | | ✓ |
`;

function rows(table: string): string[][] {
  return table
    .trim()
    .split('\n')
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
}

const names = (codes: string[], displayNames: Record<string, string>) =>
  codes.map((code) => displayNames[code]);

describe('races and classes by faction', () => {
  const table = rows(RACES_AND_CLASSES);

  it.each(table)('%s %s can be %s', (faction, race, classes) => {
    const factionCode = FACTIONS.find((code) => FACTION_NAMES[code] === faction);
    const raceCode = factionCode
      ? racesFor(factionCode).find((code) => RACE_NAMES[code] === race)
      : undefined;

    expect(factionCode).toBeDefined();
    expect(raceCode).toBeDefined();
    if (!factionCode || !raceCode) return;

    expect(names(classesFor(factionCode, raceCode), CLASS_NAMES).sort()).toEqual(
      classes?.split(', ').sort(),
    );
  });

  it.each(FACTIONS)('has no %s races beyond the table', (faction) => {
    const expected = table
      .filter(([tableFaction]) => tableFaction === FACTION_NAMES[faction])
      .map(([, race]) => race);

    expect(names(racesFor(faction), RACE_NAMES).sort()).toEqual(expected.sort());
  });

  it('includes the changes from Classic', () => {
    expect(classesFor('alliance', 'dwarf')).toContain('shaman');
    expect(classesFor('horde', 'undead')).toContain('paladin');
    expect(racesFor('alliance')).toContain('skyborne');
    expect(racesFor('horde')).toContain('skyborne');
  });
});

describe('combat roles by class', () => {
  const table = rows(ROLES_BY_CLASS);

  it('covers every class', () => {
    expect(table.map(([name]) => name).sort()).toEqual(names([...CLASSES], CLASS_NAMES).sort());
  });

  it.each(table)('%s: Tank %s, Healer %s, DPS %s', (className, tank, healer, dps) => {
    const code = CLASSES.find((candidate) => CLASS_NAMES[candidate] === className);
    if (!code) throw new Error(`Unknown class ${className}`);

    const expected = [
      tank && COMBAT_ROLE_NAMES.tank,
      healer && COMBAT_ROLE_NAMES.healer,
      dps && COMBAT_ROLE_NAMES.dps,
    ].filter(Boolean);
    expect(names(rolesFor(code), COMBAT_ROLE_NAMES)).toEqual(expected);
  });
});

describe('professions', () => {
  it('are the Classic ones', () => {
    expect(names([...PROFESSIONS], PROFESSION_NAMES)).toEqual([
      'Alchemy',
      'Blacksmithing',
      'Enchanting',
      'Engineering',
      'Herbalism',
      'Leatherworking',
      'Mining',
      'Skinning',
      'Tailoring',
      'Cooking',
      'First Aid',
      'Fishing',
    ]);
  });
});
