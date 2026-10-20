import { isLoginError } from '@wgm/shared';
import { useTranslation } from 'react-i18next';
import { Navigate, useSearchParams } from 'react-router';

import { discordLoginUrl, useMe } from '../api/me';
import { Button, Notice, Splash } from '../components/ui';
import { currentLocale } from '../i18n';
import { browserTimeZone } from '../i18n/format';

export function LoginPage() {
  const { t } = useTranslation();
  const me = useMe();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  if (me.data) {
    return <Navigate to="/" replace />;
  }

  return (
    <Splash initials="GM" title={t('app.name')} lead={t('login.lead')}>
      {isLoginError(error) && (
        <Notice tone={error === 'cancelled' ? 'warn' : 'bad'} title={t(`login.errors.${error}`)} />
      )}
      <Splash.Actions>
        <Button
          variant="primary"
          size="large"
          href={discordLoginUrl(currentLocale(), browserTimeZone())}
          endIcon="arrowRight"
        >
          {t('login.button')}
        </Button>
      </Splash.Actions>
      <Splash.Note>{t('login.note')}</Splash.Note>
    </Splash>
  );
}
