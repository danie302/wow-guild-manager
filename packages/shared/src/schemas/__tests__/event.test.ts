import { describe, expect, it } from 'vitest';

import { toValidationIssues } from '../../validation.js';
import { createEventSchema, type CreateEventInput } from '../event.js';

const raid: CreateEventInput = {
  type: 'raid',
  name: 'Molten Core',
  description: 'Fire resistance gear.',
  startsAt: '2026-11-10T19:00:00.000Z',
  size: 40,
  slots: { tank: 4, healer: 10, dps: 26 },
};

function issues(input: CreateEventInput) {
  const result = createEventSchema.safeParse(input);
  return result.success ? [] : toValidationIssues(result.error, input);
}

describe('createEventSchema', () => {
  it('accepts a raid whose slots add up to 10, 20, or 40', () => {
    expect(issues(raid)).toEqual([]);
    expect(issues({ ...raid, size: 20, slots: { tank: 2, healer: 5, dps: 13 } })).toEqual([]);
  });

  it('refuses other raid sizes, and slots that do not add up', () => {
    expect(issues({ ...raid, size: 25, slots: { tank: 3, healer: 6, dps: 16 } })).toEqual([
      { field: 'size', code: 'INVALID_RAID_SIZE' },
    ]);
    expect(issues({ ...raid, slots: { tank: 4, healer: 10, dps: 20 } })).toEqual([
      { field: 'slots', code: 'SLOTS_DONT_ADD_UP' },
    ]);
  });

  it('only accepts 1 Tank, 1 Healer, and 3 DPS for a dungeon', () => {
    const dungeon = { ...raid, type: 'dungeon' as const, size: 5 };
    expect(issues({ ...dungeon, slots: { tank: 1, healer: 1, dps: 3 } })).toEqual([]);
    expect(issues({ ...dungeon, slots: { tank: 2, healer: 1, dps: 2 } })).toEqual([
      { field: 'slots', code: 'DUNGEON_SLOTS_FIXED' },
    ]);
  });

  it('accepts any PvP size from 1 to 80 whose slots add up', () => {
    const pvp = { ...raid, type: 'pvp' as const };
    expect(issues({ ...pvp, size: 15, slots: { tank: 0, healer: 3, dps: 12 } })).toEqual([]);
    expect(issues({ ...pvp, size: 80, slots: { tank: 0, healer: 20, dps: 60 } })).toEqual([]);
    expect(issues({ ...pvp, size: 81, slots: { tank: 0, healer: 21, dps: 60 } })).toEqual([
      { field: 'size', code: 'TOO_BIG', params: { count: 80 } },
    ]);
  });

  it('needs a name and a UTC time, and trims the text', () => {
    expect(issues({ ...raid, name: '  ', startsAt: 'next tuesday' })).toEqual([
      { field: 'name', code: 'REQUIRED' },
      { field: 'startsAt', code: 'INVALID_FORMAT' },
    ]);
    expect(
      createEventSchema.parse({ ...raid, name: ' MC ', description: undefined }),
    ).toMatchObject({
      name: 'MC',
      description: '',
    });
  });
});
