import { SUPPORTED_LOCALES, type Locale } from '@wgm/shared';
import i18next, { type ParseKeys, type TFunction } from 'i18next';

import en from '../locales/en/translation.json' with { type: 'json' };
import es from '../locales/es/translation.json' with { type: 'json' };

export const DEFAULT_LOCALE: Locale = 'en';

/** Translations for the API, bot, and worker. Each message picks its locale with `translator`. */
export const i18n = i18next.createInstance();

await i18n.init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  // Discord and JSON aren't HTML, so values aren't escaped.
  interpolation: { escapeValue: false },
});

export type Translate = TFunction;

/** Every translation key, e.g. "commands.ping.reply". */
export type TranslationKey = ParseKeys;

/** A translate function fixed to one locale. */
export function translator(locale: Locale): Translate {
  return i18n.getFixedT(locale);
}

export const resources = { en, es };
