import { characterSchema, classesFor } from '@wgm/shared';
import { describe, expect, it } from 'vitest';

// The server uses the same game rules as the web client.
describe('@wgm/shared in the server', () => {
  it('validates characters with the shared schema', () => {
    expect(classesFor('alliance', 'dwarf')).toContain('shaman');
    expect(
      characterSchema.safeParse({
        name: 'Magni',
        faction: 'alliance',
        race: 'dwarf',
        class: 'shaman',
        level: 60,
        professions: ['mining'],
      }).success,
    ).toBe(true);
  });
});
