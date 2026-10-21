/**
 * Calendar days in a time zone, without a date library. A day is { year, month (1–12), day },
 * and is turned into a Date only at UTC noon, so arithmetic never crosses a day boundary.
 */
export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

/** The calendar day a moment falls on in a time zone. */
export function dayInTimeZone(value: Date, timeZone: string): CalendarDay {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(value);
  const part = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

/** "2026-11-05", to compare and key days. */
export function dayKey({ year, month, day }: CalendarDay): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The day as a Date at UTC noon, for arithmetic and formatting with timeZone "UTC". */
export function noonUtc({ year, month, day }: CalendarDay): Date {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function addDays(value: CalendarDay, days: number): CalendarDay {
  const date = noonUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function addMonths({ year, month }: CalendarDay, months: number): CalendarDay {
  const index = year * 12 + (month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1, day: 1 };
}

/** Sunday (0) in English, Monday (1) in Spanish, as calendars there usually start. */
export function firstWeekday(language: string): 0 | 1 {
  return language.startsWith('es') ? 1 : 0;
}

/** The weeks shown for a month: whole weeks from the one with the 1st to the one with the last day. */
export function monthWeeks(month: CalendarDay, weekStartsOn: 0 | 1): CalendarDay[][] {
  const first = { ...month, day: 1 };
  const offset = (noonUtc(first).getUTCDay() - weekStartsOn + 7) % 7;
  let day = addDays(first, -offset);
  const weeks: CalendarDay[][] = [];
  do {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  } while (day.month === month.month);
  return weeks;
}

/**
 * A UTC range that surely covers the given days in any time zone (a day either side), for
 * asking the API for a month's events.
 */
export function utcRangeAround(
  first: CalendarDay,
  last: CalendarDay,
): { from: string; to: string } {
  return {
    from: noonUtc(addDays(first, -2)).toISOString(),
    to: noonUtc(addDays(last, 2)).toISOString(),
  };
}

/** A moment as the date ("2026-11-10") and time ("19:00") it shows in a time zone, for forms. */
export function toZonedFields(value: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

/**
 * The moment a date and time entered in a time zone stand for, or null if they aren't valid.
 * Around a daylight saving change, a time that doesn't exist moves forward like a clock does.
 */
export function fromZonedFields(date: string, time: string, timeZone: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const wanted = Date.UTC(+d[1]!, +d[2]! - 1, +d[3]!, +t[1]!, +t[2]!);
  if (Number.isNaN(wanted)) return null;
  // The zone's offset at a moment: what its clock shows minus UTC.
  const offset = (moment: number) => {
    const shown = toZonedFields(new Date(moment), timeZone);
    const [y, m, day] = shown.date.split('-').map(Number);
    const [h, min] = shown.time.split(':').map(Number);
    return Date.UTC(y!, m! - 1, day, h, min) - moment;
  };
  // Guess with the offset at the wanted time, then correct once for a change in between.
  let moment = wanted - offset(wanted);
  moment = wanted - offset(moment);
  return new Date(moment);
}
