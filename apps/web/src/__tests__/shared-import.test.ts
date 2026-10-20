import { characterSchema, classesFor } from '@wgm/shared';
import { describe, expect, it } from 'vitest';

// The web client uses the same game rules as the server.
describe('@wgm/shared in the web client', () => {
  it('validates characters with the shared schema', () => {
    expect(classesFor('horde', 'undead')).toContain('paladin');
    expect(
      characterSchema.safeParse({
        name: 'Sylvanas',
        faction: 'horde',
        race: 'undead',
        class: 'paladin',
        level: 60,
        professions: ['tailoring'],
      }).success,
    ).toBe(true);
  });
});
