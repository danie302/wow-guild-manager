import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { AppShell } from '../components/ui';

export function Layout() {
  const { t } = useTranslation();

  return (
    <AppShell>
      <AppShell.Sidebar>
        <AppShell.Brand title={t('app.name')} subtitle={t('app.game')} initials="GM" />
        <AppShell.Nav label={t('nav.label')}>
          <AppShell.NavItem to="/" icon="dashboard" end>
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
      </AppShell.Sidebar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
