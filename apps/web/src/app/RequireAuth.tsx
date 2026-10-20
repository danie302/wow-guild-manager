import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet } from 'react-router';

import { useMe } from '../api/me';
import { Loading, Notice, Splash } from '../components/ui';
import { changeLocale, currentLocale } from '../i18n';

/** Shows its routes only to a logged-in user, and sends everyone else to the login page. */
export function RequireAuth() {
  const { t } = useTranslation();
  const me = useMe();

  // The language saved on the user wins over the one this browser had.
  const savedLocale = me.data?.locale;
  useEffect(() => {
    if (savedLocale && savedLocale !== currentLocale()) {
      void changeLocale(savedLocale);
    }
  }, [savedLocale]);

  if (me.isPending) {
    return <Loading label={t('auth.checking')} />;
  }
  if (me.isError) {
    return (
      <Splash initials="GM" title={t('app.name')}>
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
