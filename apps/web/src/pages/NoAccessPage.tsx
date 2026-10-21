import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';

import { useLogout, useMe } from '../api/me';
import { Button, Splash } from '../components/ui';

/** For a logged-in user who isn't the Guild Master or an Officer of any guild. */
export function NoAccessPage() {
  const { t } = useTranslation();
  const me = useMe().data;
  const logout = useLogout();

  if (me && me.guilds.length > 0) {
    return <Navigate to="/" replace />;
  }

  return (
    <Splash
      initials="GM"
      title={t('noAccess.title')}
      lead={me ? t('noAccess.signedInAs', { name: me.name }) : undefined}
    >
      <Splash.Note>{t('noAccess.body')}</Splash.Note>
      <Splash.List>
        <Splash.Card title={t('noAccess.signUpTitle')}>{t('noAccess.signUp')}</Splash.Card>
        <Splash.Card title={t('noAccess.officerTitle')}>{t('noAccess.officer')}</Splash.Card>
        {me?.canCreateGuild && (
          <Splash.Card
            title={t('noAccess.newGuildTitle')}
            action={
              <Button variant="primary" to="/setup">
                {t('noAccess.createGuild')}
              </Button>
            }
          >
            {t('noAccess.newGuild')}
          </Splash.Card>
        )}
      </Splash.List>
      <Splash.Actions>
        <Button onClick={() => logout.mutate()} disabled={logout.isPending}>
          {t('noAccess.otherAccount')}
        </Button>
      </Splash.Actions>
    </Splash>
  );
}
