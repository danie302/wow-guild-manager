import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { useLogout, useMe, useSaveSettings } from '../api/me';

import { AppShell, Button, useThemeMode } from '../components/ui';

export function Layout() {
  const { t } = useTranslation();
  // RequireAuth renders this layout only once the user is loaded.
  const me = useMe().data;
  const logout = useLogout();
  const saveSettings = useSaveSettings();
  const { theme, setTheme } = useThemeMode();
  const otherTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <AppShell>
      <AppShell.Sidebar>
        <AppShell.Brand title={t('app.name')} subtitle={t('app.game')} initials="GM" />
        <AppShell.Nav label={t('nav.label')}>
          <AppShell.NavItem to="/dashboard" icon="dashboard">
            {t('nav.dashboard')}
          </AppShell.NavItem>
          <AppShell.NavItem to="/events" icon="events">
            {t('nav.events')}
          </AppShell.NavItem>
          <AppShell.NavItem to="/roster" icon="roster">
            {t('nav.roster')}
          </AppShell.NavItem>
          <AppShell.NavItem to="/registrations" icon="registrations">
            {t('nav.registrations')}
          </AppShell.NavItem>
          <AppShell.NavItem to="/attendance" icon="report">
            {t('nav.attendance')}
          </AppShell.NavItem>
          <AppShell.NavSeparator />
          <AppShell.NavItem to="/settings/guild" icon="guildSettings">
            {t('nav.guildSettings')}
          </AppShell.NavItem>
          <AppShell.NavItem to="/settings/user" icon="user">
            {t('nav.userSettings')}
          </AppShell.NavItem>
          <AppShell.NavItem to="/status" icon="status">
            {t('nav.status')}
          </AppShell.NavItem>
        </AppShell.Nav>
        {me && (
          <AppShell.Account name={me.name} avatarUrl={me.avatarUrl}>
            <Button
              onClick={() => {
                setTheme(otherTheme);
                saveSettings.mutate({ theme: otherTheme });
              }}
            >
              {t(otherTheme === 'light' ? 'settings.switchToLight' : 'settings.switchToDark')}
            </Button>
            <Button onClick={() => logout.mutate()} disabled={logout.isPending}>
              {t('auth.signOut')}
            </Button>
          </AppShell.Account>
        )}
      </AppShell.Sidebar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
