import { describe, expect, it } from 'vitest';

import { addMonths, dayInTimeZone, dayKey, monthWeeks, utcRangeAround } from '../calendar';

describe('calendar days', () => {
  it('puts a moment on the day it falls on in the time zone', () => {
    const late = new Date('2026-11-11T02:00:00Z');

    expect(dayKey(dayInTimeZone(late, 'UTC'))).toBe('2026-11-11');
    expect(dayKey(dayInTimeZone(late, 'America/Argentina/Buenos_Aires'))).toBe('2026-11-10');
  });

  it('lays a month out in whole weeks, starting on Sunday or Monday', () => {
    const november = { year: 2026, month: 11, day: 1 };

    const sunday = monthWeeks(november, 0);
    const monday = monthWeeks(november, 1);

    // November 1st, 2026 is a Sunday.
    expect(sunday.map((week) => dayKey(week[0]!))).toEqual([
      '2026-11-01',
      '2026-11-08',
      '2026-11-15',
      '2026-11-22',
      '2026-11-29',
    ]);
    expect(dayKey(monday[0]![0]!)).toBe('2026-10-26');
    expect(dayKey(monday.at(-1)!.at(-1)!)).toBe('2026-12-06');
  });

  it('moves between months across years', () => {
    expect(addMonths({ year: 2026, month: 12, day: 15 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
    expect(addMonths({ year: 2026, month: 1, day: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
      day: 1,
    });
  });

  it('asks for a UTC range wide enough for any time zone', () => {
    expect(
      utcRangeAround({ year: 2026, month: 11, day: 1 }, { year: 2026, month: 12, day: 5 }),
    ).toEqual({ from: '2026-10-30T12:00:00.000Z', to: '2026-12-07T12:00:00.000Z' });
  });
});
