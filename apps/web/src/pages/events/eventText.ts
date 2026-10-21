import type { TFunction } from 'i18next';

import type { formatters } from '../../i18n/format';

type Format = ReturnType<typeof formatters>;

/** Each combat role's color token. */
export const roleColor = { tank: 'tank', healer: 'heal', dps: 'dps' } as const;

/** "Thursday, October 15 · 8:00 PM", in the user's time zone. */
export function whenText(format: Format, date: Date): string {
  return `${format.parts(date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${format.shortTime(date)}`;
}

/** "Every Tuesday at 7:00 PM", in the user's time zone. */
export function everyWeekText(t: TFunction, format: Format, startsAt: string): string {
  const date = new Date(startsAt);
  return t('series.every', {
    weekday: format.parts(date, { weekday: 'long' }),
    time: format.shortTime(date),
  });
}
