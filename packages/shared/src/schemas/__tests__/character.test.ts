import { describe, expect, it } from 'vitest';

import { CHARACTER_ERROR_CODES, characterSchema, classRoleSchema } from '../character.js';

const valid = {
  name: 'Thrall',
  faction: 'horde',
  race: 'orc',
  class: 'shaman',
  level: 60,
  professions: ['alchemy', 'herbalism'],
} as const;

function errors(input: unknown): string[] {
  const result = characterSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('characterSchema', () => {
  it('accepts a valid character', () => {
    expect(characterSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['alliance', 'skyborne', 'mage'],
    ['horde', 'skyborne', 'shaman'],
    ['alliance', 'dwarf', 'shaman'],
    ['horde', 'undead', 'paladin'],
  ])('accepts a %s %s %s', (faction, race, characterClass) => {
    expect(errors({ ...valid, faction, race, class: characterClass })).toEqual([]);
  });

  it.each([
    ['horde', 'human', 'warrior'],
    ['alliance', 'orc', 'warrior'],
  ])('rejects a %s %s', (faction, race, characterClass) => {
    expect(errors({ ...valid, faction, race, class: characterClass })).toEqual([
      CHARACTER_ERROR_CODES.raceNotInFaction,
    ]);
  });

  it.each([
    ['alliance', 'gnome', 'hunter'],
    ['alliance', 'skyborne', 'shaman'],
    ['horde', 'skyborne', 'mage'],
    ['horde', 'tauren', 'rogue'],
  ])('rejects a %s %s %s', (faction, race, characterClass) => {
    expect(errors({ ...valid, faction, race, class: characterClass })).toEqual([
      CHARACTER_ERROR_CODES.classNotForRace,
    ]);
  });

  it.each([1, 60])('accepts level %d', (level) => {
    expect(errors({ ...valid, level })).toEqual([]);
  });

  it.each([0, 61, -1, 30.5, '60'])('rejects level %s', (level) => {
    expect(errors({ ...valid, level })).not.toEqual([]);
  });

  it('rejects an empty name, and trims it', () => {
    expect(errors({ ...valid, name: '   ' })).not.toEqual([]);
    expect(characterSchema.parse({ ...valid, name: '  Thrall ' }).name).toBe('Thrall');
  });

  it('requires at least one profession', () => {
    expect(errors({ ...valid, professions: [] })).not.toEqual([]);
  });

  it('rejects a profession that is not in the list', () => {
    expect(errors({ ...valid, professions: ['jewelcrafting'] })).not.toEqual([]);
  });

  it('rejects a repeated profession', () => {
    expect(errors({ ...valid, professions: ['mining', 'mining'] })).toEqual([
      CHARACTER_ERROR_CODES.duplicateProfession,
    ]);
  });

  it('allows two primary professions plus every secondary one', () => {
    expect(
      errors({
        ...valid,
        professions: ['mining', 'blacksmithing', 'cooking', 'first_aid', 'fishing'],
      }),
    ).toEqual([]);
  });

  it('rejects a third primary profession', () => {
    expect(errors({ ...valid, professions: ['mining', 'blacksmithing', 'engineering'] })).toEqual([
      CHARACTER_ERROR_CODES.tooManyPrimaryProfessions,
    ]);
  });
});

describe('classRoleSchema', () => {
  it.each([
    ['warrior', 'tank'],
    ['druid', 'healer'],
    ['paladin', 'tank'],
    ['hunter', 'dps'],
  ])('accepts a %s %s', (characterClass, role) => {
    expect(classRoleSchema.safeParse({ class: characterClass, role }).success).toBe(true);
  });

  it.each([
    ['warrior', 'healer'],
    ['priest', 'tank'],
    ['mage', 'healer'],
    ['shaman', 'tank'],
  ])('rejects a %s %s', (characterClass, role) => {
    const result = classRoleSchema.safeParse({ class: characterClass, role });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(CHARACTER_ERROR_CODES.classCannotFillRole);
  });
});
