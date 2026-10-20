import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { characterSchema } from '../schemas/character.js';
import { updateMeSchema } from '../api.js';
import { isValidTimeZone } from '../preferences.js';
import { toValidationIssues } from '../validation.js';

function issuesFor(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('Expected the input to be invalid');
  return toValidationIssues(result.error, input);
}

describe('toValidationIssues', () => {
  const schema = z.object({
    name: z.string().trim().min(2).max(12),
    level: z.number().int().min(1).max(60),
    tags: z.array(z.string()).min(1).max(2),
    kind: z.enum(['a', 'b']),
    email: z.email().optional(),
  });
  const valid = { name: 'Thrall', level: 60, tags: ['x'], kind: 'a' };

  it('reports missing and blank fields as REQUIRED', () => {
    expect(issuesFor(schema, { ...valid, name: undefined })).toEqual([
      { field: 'name', code: 'REQUIRED' },
    ]);
    expect(issuesFor(schema, { ...valid, name: '   ' })).toEqual([
      { field: 'name', code: 'REQUIRED' },
    ]);
  });

  it('reports length and size limits with their count', () => {
    expect(issuesFor(schema, { ...valid, name: 'A', level: 61, tags: ['x', 'y', 'z'] })).toEqual([
      { field: 'name', code: 'TOO_SHORT', params: { count: 2 } },
      { field: 'level', code: 'TOO_BIG', params: { count: 60 } },
      { field: 'tags', code: 'TOO_MANY', params: { count: 2 } },
    ]);
    expect(issuesFor(schema, { ...valid, name: 'A'.repeat(13), level: 0, tags: [] })).toEqual([
      { field: 'name', code: 'TOO_LONG', params: { count: 12 } },
      { field: 'level', code: 'TOO_SMALL', params: { count: 1 } },
      { field: 'tags', code: 'TOO_FEW', params: { count: 1 } },
    ]);
  });

  it('reports wrong types, values, and formats', () => {
    expect(issuesFor(schema, { ...valid, level: 'high', kind: 'c', email: 'nope' })).toEqual([
      { field: 'level', code: 'INVALID_TYPE' },
      { field: 'kind', code: 'INVALID_VALUE' },
      { field: 'email', code: 'INVALID_FORMAT' },
    ]);
  });

  it('keeps the game-rule codes from the shared schemas, with their params', () => {
    const issues = issuesFor(characterSchema, {
      name: 'Jaina',
      faction: 'alliance',
      race: 'orc',
      class: 'mage',
      level: 60,
      professions: ['alchemy', 'herbalism', 'mining'],
    });
    expect(issues).toEqual([
      { field: 'race', code: 'RACE_NOT_IN_FACTION' },
      { field: 'professions', code: 'TOO_MANY_PRIMARY_PROFESSIONS', params: { count: 2 } },
    ]);
  });
});

describe('time zones', () => {
  it('accepts IANA names and rejects anything else with INVALID_TIME_ZONE', () => {
    expect(updateMeSchema.parse({ timeZone: 'America/Bogota' })).toEqual({
      timeZone: 'America/Bogota',
    });
    expect(updateMeSchema.parse({ timeZone: 'utc' })).toEqual({ timeZone: 'UTC' });
    expect(issuesFor(updateMeSchema, { timeZone: 'Mars/Olympus_Mons' })).toEqual([
      { field: 'timeZone', code: 'INVALID_TIME_ZONE' },
    ]);
    expect(isValidTimeZone('Europe/Madrid')).toBe(true);
    expect(isValidTimeZone('GMT+25')).toBe(false);
  });
});
