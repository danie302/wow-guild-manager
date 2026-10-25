import { describe, expect, it } from 'vitest';

import {
  attendanceBand,
  attendancePeriodStart,
  attendanceRate,
  type AttendanceStatus,
} from '../schemas/event.js';

describe('attendanceRate', () => {
  it.each([
    ['present', 1],
    ['late', 1],
    ['left_early', 1],
    ['bench', 1],
    ['absent_with_notice', 0],
    ['no_show', 0],
  ] as [AttendanceStatus, number][])('counts %s as %i attended', (status, attended) => {
    expect(attendanceRate([status])).toEqual({ attended, total: 1, rate: attended });
  });

  it('divides attended events by all events with a record', () => {
    expect(attendanceRate(['present', 'bench', 'no_show', 'absent_with_notice'])).toEqual({
      attended: 2,
      total: 4,
      rate: 0.5,
    });
  });

  it('has no rate without records', () => {
    expect(attendanceRate([])).toEqual({ attended: 0, total: 0, rate: null });
  });
});

describe('attendanceBand', () => {
  const thresholds = { good: 90, atRisk: 75 };

  it.each([
    [1, 'good'],
    [0.9, 'good'],
    [0.89, 'watch'],
    [0.75, 'watch'],
    [0.74, 'at_risk'],
    [null, null],
  ] as const)('puts %s in %s', (rate, band) => {
    expect(attendanceBand(rate, thresholds)).toBe(band);
  });
});

describe('attendancePeriodStart', () => {
  it('goes back 4 or 8 weeks, or not at all', () => {
    const now = new Date('2026-10-22T12:00:00Z');

    expect(attendancePeriodStart('4', now)).toEqual(new Date('2026-09-24T12:00:00Z'));
    expect(attendancePeriodStart('8', now)).toEqual(new Date('2026-08-27T12:00:00Z'));
    expect(attendancePeriodStart('all', now)).toBeNull();
  });
});
