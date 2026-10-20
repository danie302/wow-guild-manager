import 'i18next';

import type en from '../locales/en/translation.json' with { type: 'json' };

// Types every translation key from the English file, so a missing key is a type error.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
