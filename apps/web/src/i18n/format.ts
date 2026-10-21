import { useTranslation } from 'react-i18next';

import { useMe } from '../api/me';
import { i18n } from './index';

/** The browser's time zone, used before login and as the default for a new user. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The one place that formats dates, times, and numbers. Dates are stored in UTC and shown in
 * the logged-in user's time zone (the browser's before login), in the selected language.
 */
export function useFormat() {
  const { i18n } = useTranslation();
  const timeZone = useMe().data?.timeZone ?? browserTimeZone();
  return formatters(i18n.language, timeZone);
}

export function formatters(locale: string, timeZone: string) {
  return {
    timeZone,
    dateTime: (value: Date | number, options: Intl.DateTimeFormatOptions = {}) =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
        ...options,
      }).format(value),
    date: (value: Date | number) =>
      new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone }).format(value),
    /** How long ago, as in the design: "3 h ago" or "hace 3 h". */
    relative: (value: Date | number, now = Date.now()) => {
      const seconds = Math.max(0, Math.round((now - Number(value)) / 1000));
      const units: [string, number][] = [
        ['d', 86_400],
        ['h', 3_600],
        ['min', 60],
      ];
      const [unit, size] = units.find(([, length]) => seconds >= length) ?? ['s', 1];
      const amount = new Intl.NumberFormat(locale).format(Math.floor(seconds / size));
      return i18n.getFixedT(locale)('time.ago', { value: `${amount} ${unit}` });
    },
    /** How far away, either way, as Discord's relative timestamps: "in 3 days", "hace 2 horas". */
    fromNow: (value: Date | number, now = Date.now()) => {
      const seconds = Math.round((Number(value) - now) / 1000);
      const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 31_536_000],
        ['month', 2_592_000],
        ['day', 86_400],
        ['hour', 3_600],
        ['minute', 60],
      ];
      const [unit, size] = units.find(([, length]) => Math.abs(seconds) >= length) ?? ['second', 1];
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
        Math.round(seconds / size),
        unit,
      );
    },
    /** Only the given parts (e.g. `{ weekday: 'short' }`), in the user's time zone. */
    parts: (value: Date | number, options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(value),
    /** The hour and minute, e.g. "7:00 PM" or "19:00". */
    shortTime: (value: Date | number) =>
      new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone }).format(value),
    time: (value: Date | number) =>
      new Intl.DateTimeFormat(locale, { timeStyle: 'medium', timeZone }).format(value),
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
  };
}

/**
 * Every time zone the browser knows, for a picker: grouped by region ("America"), labelled by
 * place ("Argentina / Buenos Aires"), with the current UTC offset. Sorted by region, then place.
 */
export function timeZoneOptions(current: string, now = new Date()) {
  const names = new Set(Intl.supportedValuesOf('timeZone'));
  // A saved zone may be an alias the list leaves out (e.g. "UTC").
  names.add(current);
  return [...names]
    .map((name) => {
      const [region, ...place] = name.split('/');
      return {
        value: name,
        label: (place.length ? place.join(' / ') : name).replaceAll('_', ' '),
        group: place.length ? region : undefined,
        detail: utcOffset(name, now),
      };
    })
    .sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.label.localeCompare(b.label));
}

function utcOffset(timeZone: string, now: Date): string {
  const part = new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName');
  // "GMT" alone means UTC+00:00.
  return part?.value === 'GMT' ? 'UTC+00:00' : (part?.value.replace('GMT', 'UTC') ?? 'UTC');
}
