import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router';

import { useLogout, useMe, useSaveSettings } from '../api/me';
import { useRegistrations } from '../api/registrations';
import { guildPath, lastGuild, useGuildIdParam } from './guildSelection';

import { AppShell, Button, useThemeMode } from '../components/ui';

export function Layout() {
  const { t } = useTranslation();
  // RequireAuth renders this layout only once the user is loaded.
  const me = useMe().data;
  const logout = useLogout();
  const saveSettings = useSaveSettings();
  const { theme, setTheme } = useThemeMode();
  const otherTheme = theme === 'dark' ? 'light' : 'dark';
  const navigate = useNavigate();

  // Pages outside a guild (user settings, status) keep the last guild's links in the sidebar.
  const guilds = me?.guilds ?? [];
  const urlGuildId = useGuildIdParam();
  const guild =
    guilds.find((candidate) => candidate.id === urlGuildId) ?? lastGuild(guilds) ?? guilds[0];
  // Only the Guild Master and Officers see requests to join.
  const registrations = useRegistrations(guild?.id ?? '', {
    enabled: guild?.access === 'guild_master' || guild?.access === 'officer',
  });
  const createValue = 'new';
  const switcherOptions = [
    ...guilds.map((option) => ({ value: option.id, label: option.name })),
    ...(me?.canCreateGuild ? [{ value: createValue, label: t('nav.createGuild') }] : []),
  ];

  return (
    <AppShell>
      <AppShell.Sidebar label={guild?.name ?? t('app.name')}>
        <AppShell.Brand
          title={guild?.name ?? t('app.name')}
          subtitle={guild ? t('app.name') : t('app.game')}
          initials={initials(guild?.name ?? t('app.name'))}
          imageUrl={guild?.imageUrl}
        />
        {guild && switcherOptions.length > 1 && (
          <AppShell.Switcher
            label={t('nav.switchGuild')}
            value={guild.id}
            options={switcherOptions}
            onChange={(value) =>
              void navigate(value === createValue ? '/setup' : guildPath(value, 'dashboard'))
            }
          />
        )}
        <AppShell.Nav label={t('nav.label')}>
          {guild && (
            <>
              <AppShell.NavItem to={guildPath(guild.id, 'dashboard')} icon="dashboard">
                {t('nav.dashboard')}
              </AppShell.NavItem>
              <AppShell.NavItem to={guildPath(guild.id, 'events')} icon="events">
                {t('nav.events')}
              </AppShell.NavItem>
              <AppShell.NavItem to={guildPath(guild.id, 'roster')} icon="roster">
                {t('nav.roster')}
              </AppShell.NavItem>
              <AppShell.NavItem
                to={guildPath(guild.id, 'registrations')}
                icon="registrations"
                badge={registrations.data?.length}
              >
                {t('nav.registrations')}
              </AppShell.NavItem>
              <AppShell.NavItem to={guildPath(guild.id, 'attendance')} icon="report">
                {t('nav.attendance')}
              </AppShell.NavItem>
              <AppShell.NavSeparator />
              <AppShell.NavItem to={guildPath(guild.id, 'settings')} icon="guildSettings">
                {t('nav.guildSettings')}
              </AppShell.NavItem>
            </>
          )}
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

/** Up to two letters for the brand badge: "Ashen Vanguard" → "AV". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : name.slice(0, 2)).toUpperCase();
}
