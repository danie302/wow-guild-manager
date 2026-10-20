import { useTranslation } from 'react-i18next';

/**
 * Date and number formatting for the selected language, with the browser's Intl APIs. Times
 * use the browser's time zone until users pick their own (story 011).
 */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  return {
    dateTime: (value: Date | number, options: Intl.DateTimeFormatOptions = {}) =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        ...options,
      }).format(value),
    time: (value: Date | number) =>
      new Intl.DateTimeFormat(locale, { timeStyle: 'medium' }).format(value),
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
  };
}
