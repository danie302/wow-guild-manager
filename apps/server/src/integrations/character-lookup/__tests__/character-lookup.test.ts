import { describe, expect, it } from 'vitest';

import { FakeCharacterLookup } from '../../../../test/fake-character-lookup.js';
import { createCharacterLookup } from '../character-lookup.js';

describe('createCharacterLookup', () => {
  it('answers "unavailable" while there is no Battle.net client', async () => {
    const lookup = createCharacterLookup();
    const unavailable = { status: 'unavailable', reason: 'not_configured' };

    await expect(lookup.profile({ name: 'Thrall' })).resolves.toEqual(unavailable);
    await expect(lookup.equipment({ name: 'Thrall' })).resolves.toEqual(unavailable);
  });
});

describe('FakeCharacterLookup', () => {
  const thrall = {
    name: 'Thrall',
    faction: 'horde',
    race: 'orc',
    characterClass: 'shaman',
    level: 60,
  } as const;

  it('finds a character by name without regard to case', async () => {
    const lookup = new FakeCharacterLookup().addCharacter(thrall);

    await expect(lookup.profile({ name: 'thrall' })).resolves.toEqual({
      status: 'found',
      data: thrall,
      fetchedAt: lookup.fetchedAt,
    });
  });

  it('answers "not found" for an unknown character', async () => {
    const lookup = new FakeCharacterLookup();

    await expect(lookup.equipment({ name: 'Nobody' })).resolves.toEqual({
      status: 'not_found',
      fetchedAt: lookup.fetchedAt,
    });
  });

  it('answers "unavailable" when it is down', async () => {
    const lookup = new FakeCharacterLookup().addCharacter(thrall);
    lookup.down = true;

    await expect(lookup.profile({ name: 'Thrall' })).resolves.toEqual({
      status: 'unavailable',
      reason: 'error',
    });
  });
});
