import { SUPPORTED_LOCALES } from '@wgm/shared';
import { useTranslation } from 'react-i18next';

import { useSaveLocale } from '../api/me';
import { ChoiceGroup, Page } from '../components/ui';
import { changeLocale, currentLocale, LOCALE_NAMES } from '../i18n';

// Only the language for now. Story 011 builds the full page (time zone, theme).
// The language changes right away and is then saved on the user for their other devices.
export function UserSettingsPage() {
  const { t } = useTranslation();
  const saveLocale = useSaveLocale();

  return (
    <Page>
      <Page.Header>
        <Page.Title>{t('userSettings.title')}</Page.Title>
      </Page.Header>
      <ChoiceGroup
        label={t('userSettings.language')}
        value={currentLocale()}
        onChange={(locale) => {
          void changeLocale(locale);
          saveLocale.mutate(locale);
        }}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <ChoiceGroup.Option key={locale} value={locale}>
            <span lang={locale}>{LOCALE_NAMES[locale]}</span>
          </ChoiceGroup.Option>
        ))}
      </ChoiceGroup>
    </Page>
  );
}
