import { describe, expect, it } from 'vitest';

import { hasOffensiveWords } from '../offensive-words.js';

describe('hasOffensiveWords', () => {
  it.each(['Fuck Raiders', 'Hijos de Puta', 'Los Pendejos', 'MALPARIDOS', 'Coño'])(
    'finds an offensive word in "%s"',
    (name) => {
      expect(hasOffensiveWords(name)).toBe(true);
    },
  );

  it('ignores accents, so "cabron" is caught like "cabrón"', () => {
    expect(hasOffensiveWords('Cabrón')).toBe(true);
    expect(hasOffensiveWords('Los Cabrones')).toBe(true);
    expect(hasOffensiveWords('cabron')).toBe(true);
  });

  it.each(['Ashen Vanguard', 'Scunthorpe', 'Assassins', 'Vehículo Rojo', 'Cono Sur', 'Concha'])(
    'allows "%s", which only contains an offensive word or has an innocent meaning',
    (name) => {
      expect(hasOffensiveWords(name)).toBe(false);
    },
  );
});
