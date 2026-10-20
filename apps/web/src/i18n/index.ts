import { isLocale, SUPPORTED_LOCALES, type Locale } from '@wgm/shared';
import i18next, { type ParseKeys } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';

export const DEFAULT_LOCALE: Locale = 'en';

/** Every translation key, e.g. "nav.events". */
export type TranslationKey = ParseKeys;

/** Each language's name in that language, for the language picker. Not translated on purpose. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', es: 'Español' };

// Until app users exist (story 010), the chosen language is kept in the browser.
const STORAGE_KEY = 'wgm.locale';

export const resources = { en, es };

/** The saved language, else the first supported browser language, else English. */
export function detectLocale(saved: string | null, browserLanguages: readonly string[]): Locale {
  if (isLocale(saved)) return saved;
  for (const language of browserLanguages) {
    const base = language.split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

function savedLocale(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: detectLocale(savedLocale(), navigator.languages),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  // React already escapes text.
  interpolation: { escapeValue: false },
  initAsync: false,
});

document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
});

/** Switches the language right away, without reloading, and remembers it. */
export async function changeLocale(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale);
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Private windows can block storage; the language still changes for this visit.
  }
}

export function currentLocale(): Locale {
  return isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
}
