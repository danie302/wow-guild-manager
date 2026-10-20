import {
  SUPPORTED_LOCALES,
  THEMES,
  type Locale,
  type Theme,
  type UpdateMeInput,
} from '@wgm/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useMe, useSaveSettings } from '../api/me';
import { ChoiceGroup, Page, Select, useThemeMode } from '../components/ui';
import { changeLocale, currentLocale, LOCALE_NAMES } from '../i18n';
import { browserTimeZone, timeZoneOptions, useFormat } from '../i18n/format';

/** The user's own settings. Each change applies right away and is saved on the user. */
export function UserSettingsPage() {
  const { t } = useTranslation();
  const me = useMe().data;
  const format = useFormat();
  const save = useSaveSettings();
  const { theme, setTheme } = useThemeMode();
  const timeZone = me?.timeZone ?? browserTimeZone();
  const zones = useMemo(() => timeZoneOptions(timeZone), [timeZone]);

  const saveSetting = (settings: UpdateMeInput) => save.mutate(settings);

  return (
    <Page>
      <Page.Header>
        <Page.Title>{t('settings.title')}</Page.Title>
        <span role="status">{save.isSuccess && t('settings.saved')}</span>
      </Page.Header>
      <Page.Setting title={t('settings.timeZone')} description={t('settings.timeZoneHelp')}>
        <Select
          label={t('settings.timeZone')}
          hideLabel
          value={timeZone}
          options={zones}
          onChange={(value) => saveSetting({ timeZone: value })}
          hint={t('settings.timeZonePreview', { time: format.dateTime(new Date()) })}
        />
      </Page.Setting>
      <Page.Setting title={t('settings.language')}>
        <ChoiceGroup
          label={t('settings.language')}
          hideLabel
          value={currentLocale()}
          onChange={(locale: Locale) => {
            void changeLocale(locale);
            saveSetting({ locale });
          }}
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <ChoiceGroup.Option key={locale} value={locale}>
              <span lang={locale}>{LOCALE_NAMES[locale]}</span>
            </ChoiceGroup.Option>
          ))}
        </ChoiceGroup>
      </Page.Setting>
      <Page.Setting title={t('settings.theme')}>
        <ChoiceGroup
          label={t('settings.theme')}
          hideLabel
          value={theme}
          onChange={(next: Theme) => {
            setTheme(next);
            saveSetting({ theme: next });
          }}
        >
          {THEMES.map((option) => (
            <ChoiceGroup.Option key={option} value={option}>
              {t(option === 'dark' ? 'settings.dark' : 'settings.light')}
            </ChoiceGroup.Option>
          ))}
        </ChoiceGroup>
      </Page.Setting>
    </Page>
  );
}
