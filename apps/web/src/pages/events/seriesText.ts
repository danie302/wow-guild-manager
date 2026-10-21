import type { TFunction } from 'i18next';

import type { formatters } from '../../i18n/format';

/** "Every Tuesday at 7:00 PM", in the user's time zone. */
export function everyWeekText(
  t: TFunction,
  format: ReturnType<typeof formatters>,
  startsAt: string,
): string {
  const date = new Date(startsAt);
  return t('series.every', {
    weekday: format.parts(date, { weekday: 'long' }),
    time: format.shortTime(date),
  });
}
