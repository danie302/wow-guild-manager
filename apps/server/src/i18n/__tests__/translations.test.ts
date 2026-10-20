import {
  CLASS_NAMES,
  CLASSES,
  COMBAT_ROLE_NAMES,
  COMBAT_ROLES,
  PROFESSION_NAMES,
  PROFESSIONS,
  RACE_NAMES,
  RACES,
} from '@wgm/shared';
import { describe, expect, it } from 'vitest';

import { resources, translator, type TranslationKey } from '../index.js';

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('server translations', () => {
  it('have exactly the same keys in English and Spanish', () => {
    expect(keysOf(resources.es).sort()).toEqual(keysOf(resources.en).sort());
  });

  it('have no empty values', () => {
    for (const [locale, translation] of Object.entries(resources)) {
      const t = translator(locale as keyof typeof resources);
      for (const key of keysOf(translation)) {
        expect(t(key as TranslationKey), `${locale}: ${key}`).not.toBe('');
      }
    }
  });

  it('have no entries for game terms, which come from @wgm/shared in English', () => {
    const codes = new Set<string>([...CLASSES, ...RACES, ...PROFESSIONS, ...COMBAT_ROLES]);
    const names = [CLASS_NAMES, RACE_NAMES, PROFESSION_NAMES, COMBAT_ROLE_NAMES].flatMap((table) =>
      Object.values(table),
    );
    for (const [locale, translation] of Object.entries(resources)) {
      for (const key of keysOf(translation)) {
        expect(
          key.split('.').filter((part) => codes.has(part)),
          `${locale}: ${key}`,
        ).toEqual([]);
      }
      const text = JSON.stringify(translation);
      expect(
        names.filter((name) => new RegExp(`\\b${name}\\b`).test(text)),
        locale,
      ).toEqual([]);
    }
  });

  it('rejects unknown keys at compile time', () => {
    const t = translator('en');
    // @ts-expect-error: the key doesn't exist
    expect(t('commands.nope')).toBe('commands.nope');
  });
});
