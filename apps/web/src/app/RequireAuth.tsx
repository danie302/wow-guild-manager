import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet } from 'react-router';

import { useMe } from '../api/me';
import { Loading, Notice, Splash, useThemeMode } from '../components/ui';
import { changeLocale, currentLocale } from '../i18n';

/** Shows its routes only to a logged-in user, and sends everyone else to the login page. */
export function RequireAuth() {
  const { t } = useTranslation();
  const me = useMe();

  const { theme, setTheme } = useThemeMode();

  // The language and theme saved on the user win over the ones this browser had.
  const savedLocale = me.data?.locale;
  useEffect(() => {
    if (savedLocale && savedLocale !== currentLocale()) {
      void changeLocale(savedLocale);
    }
  }, [savedLocale]);
  const savedTheme = me.data?.theme;
  useEffect(() => {
    if (savedTheme && savedTheme !== theme) {
      setTheme(savedTheme);
    }
    // Only when the saved theme changes, not on every local switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTheme]);

  if (me.isPending) {
    return <Loading label={t('auth.checking')} />;
  }
  if (me.isError) {
    return (
      <Splash title={t('app.name')}>
        <Notice tone="bad" title={t('auth.unavailableTitle')}>
          {t('errors.API_UNAVAILABLE')}
        </Notice>
      </Splash>
    );
  }
  if (!me.data) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
