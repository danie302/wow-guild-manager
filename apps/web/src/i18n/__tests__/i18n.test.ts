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

import { apiErrorMessage, validationIssueMessage } from '../api-errors';
import { detectLocale, i18n, resources } from '../index';

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('web translations', () => {
  it('have exactly the same keys in English and Spanish', () => {
    expect(keysOf(resources.es).sort()).toEqual(keysOf(resources.en).sort());
  });

  it('have no empty values', () => {
    for (const translation of Object.values(resources)) {
      expect(keysOf(translation).filter((key) => key === '')).toEqual([]);
      expect(JSON.stringify(translation)).not.toContain('""');
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

  it('reject unknown keys at compile time', () => {
    const t = i18n.getFixedT('en');
    // @ts-expect-error: the key doesn't exist
    expect(t('nav.nope')).toBe('nav.nope');
  });
});

describe('detectLocale', () => {
  it('prefers the saved language', () => {
    expect(detectLocale('es', ['en-US'])).toBe('es');
  });

  it('uses the first supported browser language', () => {
    expect(detectLocale(null, ['fr-FR', 'es-MX', 'en-US'])).toBe('es');
    expect(detectLocale('xx', ['en-GB'])).toBe('en');
  });

  it('falls back to English', () => {
    expect(detectLocale(null, ['fr-FR', 'de'])).toBe('en');
    expect(detectLocale(null, [])).toBe('en');
  });
});

describe('API error messages', () => {
  it('translates error codes and validation issues with their parameters', () => {
    const es = i18n.getFixedT('es');
    const en = i18n.getFixedT('en');

    expect(apiErrorMessage(es, { code: 'NOT_FOUND' })).toBe('No encontramos lo que buscabas.');
    expect(
      validationIssueMessage(en, { field: 'name', code: 'TOO_LONG', params: { count: 12 } }),
    ).toBe('Must be at most 12 characters.');
    expect(
      validationIssueMessage(es, { field: 'name', code: 'TOO_SHORT', params: { count: 1 } }),
    ).toBe('Debe tener al menos 1 carácter.');
    expect(
      validationIssueMessage(es, {
        field: 'professions',
        code: 'TOO_MANY_PRIMARY_PROFESSIONS',
        params: { count: 2 },
      }),
    ).toBe('Un personaje puede tener como máximo 2 profesiones principales.');
  });

  it('has a message for every error and validation code', async () => {
    const { VALIDATION_ISSUE_CODES } = await import('@wgm/shared');
    const en = i18n.getFixedT('en');
    for (const code of VALIDATION_ISSUE_CODES) {
      expect(validationIssueMessage(en, { field: 'x', code, params: { count: 2 } })).not.toMatch(
        /^validation\./,
      );
    }
    for (const code of ['NOT_FOUND', 'INVALID_JSON', 'INTERNAL_ERROR'] as const) {
      expect(apiErrorMessage(en, { code })).not.toMatch(/^errors\./);
    }
  });
});
