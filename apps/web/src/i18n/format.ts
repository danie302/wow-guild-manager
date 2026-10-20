import { useTranslation } from 'react-i18next';

import { useMe } from '../api/me';

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
    time: (value: Date | number) =>
      new Intl.DateTimeFormat(locale, { timeStyle: 'medium', timeZone }).format(value),
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
  };
}

/** Every time zone the browser knows, with its current UTC offset, sorted by name. */
export function timeZoneOptions(current: string, now = new Date()) {
  const names = new Set(Intl.supportedValuesOf('timeZone'));
  // A saved zone may be an alias the list leaves out (e.g. "UTC").
  names.add(current);
  return [...names]
    .sort()
    .map((name) => ({ value: name, label: `${name} (${utcOffset(name, now)})` }));
}

function utcOffset(timeZone: string, now: Date): string {
  const part = new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName');
  // "GMT" alone means UTC+00:00.
  return part?.value === 'GMT' ? 'UTC+00:00' : (part?.value.replace('GMT', 'UTC') ?? 'UTC');
}
