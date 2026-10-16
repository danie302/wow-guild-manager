/**
 * Game rules for World of Warcraft: Forever, from requirements.md ("Characters").
 * Values are stable codes (stored in the database and sent by the API). The display names
 * below are the English game terms, shown in English in every language.
 */

export const FACTIONS = ['alliance', 'horde'] as const;
export type Faction = (typeof FACTIONS)[number];

export const RACES = [
  'human',
  'dwarf',
  'night_elf',
  'gnome',
  'orc',
  'undead',
  'tauren',
  'troll',
  'skyborne',
] as const;
export type Race = (typeof RACES)[number];

export const CLASSES = [
  'druid',
  'hunter',
  'mage',
  'paladin',
  'priest',
  'rogue',
  'shaman',
  'warlock',
  'warrior',
] as const;
export type CharacterClass = (typeof CLASSES)[number];

export const COMBAT_ROLES = ['tank', 'healer', 'dps'] as const;
export type CombatRole = (typeof COMBAT_ROLES)[number];

export const PRIMARY_PROFESSIONS = [
  'alchemy',
  'blacksmithing',
  'enchanting',
  'engineering',
  'herbalism',
  'leatherworking',
  'mining',
  'skinning',
  'tailoring',
] as const;
export const SECONDARY_PROFESSIONS = ['cooking', 'first_aid', 'fishing'] as const;
export const PROFESSIONS = [...PRIMARY_PROFESSIONS, ...SECONDARY_PROFESSIONS] as const;
export type Profession = (typeof PROFESSIONS)[number];

/** A character can have at most this many primary professions, as in Classic. */
export const MAX_PRIMARY_PROFESSIONS = 2;

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 60;

/**
 * Races by faction, and classes by race. Skyborne exists in both factions with different
 * classes, so the classes depend on the faction too. Differs from Classic: Dwarves can be
 * Shamans and Undead can be Paladins.
 */
const CLASSES_BY_RACE: Record<Faction, Partial<Record<Race, readonly CharacterClass[]>>> = {
  alliance: {
    human: ['warrior', 'paladin', 'rogue', 'priest', 'mage', 'warlock'],
    dwarf: ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman'],
    night_elf: ['warrior', 'hunter', 'rogue', 'priest', 'druid'],
    gnome: ['warrior', 'rogue', 'mage', 'warlock'],
    skyborne: ['warrior', 'hunter', 'rogue', 'druid', 'mage'],
  },
  horde: {
    orc: ['warrior', 'hunter', 'rogue', 'shaman', 'warlock'],
    undead: ['warrior', 'paladin', 'rogue', 'priest', 'mage', 'warlock'],
    tauren: ['warrior', 'hunter', 'shaman', 'druid'],
    troll: ['warrior', 'hunter', 'rogue', 'priest', 'shaman', 'mage'],
    skyborne: ['warrior', 'hunter', 'rogue', 'druid', 'shaman'],
  },
};

const ROLES_BY_CLASS: Record<CharacterClass, readonly CombatRole[]> = {
  druid: ['tank', 'healer', 'dps'],
  hunter: ['dps'],
  mage: ['dps'],
  paladin: ['tank', 'healer', 'dps'],
  priest: ['healer', 'dps'],
  rogue: ['dps'],
  shaman: ['healer', 'dps'],
  warlock: ['dps'],
  warrior: ['tank', 'dps'],
};

export function racesFor(faction: Faction): Race[] {
  return Object.keys(CLASSES_BY_RACE[faction]) as Race[];
}

/** The classes a race can be in a faction. Empty if the race isn't in that faction. */
export function classesFor(faction: Faction, race: Race): CharacterClass[] {
  return [...(CLASSES_BY_RACE[faction][race] ?? [])];
}

export function rolesFor(characterClass: CharacterClass): CombatRole[] {
  return [...ROLES_BY_CLASS[characterClass]];
}

export function isPrimaryProfession(profession: Profession): boolean {
  return (PRIMARY_PROFESSIONS as readonly Profession[]).includes(profession);
}

export const FACTION_NAMES: Record<Faction, string> = { alliance: 'Alliance', horde: 'Horde' };

export const RACE_NAMES: Record<Race, string> = {
  human: 'Human',
  dwarf: 'Dwarf',
  night_elf: 'Night Elf',
  gnome: 'Gnome',
  orc: 'Orc',
  undead: 'Undead',
  tauren: 'Tauren',
  troll: 'Troll',
  skyborne: 'Skyborne',
};

export const CLASS_NAMES: Record<CharacterClass, string> = {
  druid: 'Druid',
  hunter: 'Hunter',
  mage: 'Mage',
  paladin: 'Paladin',
  priest: 'Priest',
  rogue: 'Rogue',
  shaman: 'Shaman',
  warlock: 'Warlock',
  warrior: 'Warrior',
};

export const COMBAT_ROLE_NAMES: Record<CombatRole, string> = {
  tank: 'Tank',
  healer: 'Healer',
  dps: 'DPS',
};

export const PROFESSION_NAMES: Record<Profession, string> = {
  alchemy: 'Alchemy',
  blacksmithing: 'Blacksmithing',
  enchanting: 'Enchanting',
  engineering: 'Engineering',
  herbalism: 'Herbalism',
  leatherworking: 'Leatherworking',
  mining: 'Mining',
  skinning: 'Skinning',
  tailoring: 'Tailoring',
  cooking: 'Cooking',
  first_aid: 'First Aid',
  fishing: 'Fishing',
};
