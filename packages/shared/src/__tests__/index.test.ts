import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '../index.js';

describe('SUPPORTED_LOCALES', () => {
  it('lists English and Spanish', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'es']);
  });
});
