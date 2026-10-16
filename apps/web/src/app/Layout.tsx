import { Outlet } from 'react-router';

import { AppShell } from '../components/ui';

// Placeholder English text. Story 035 moves it to translation files.
export function Layout() {
  return (
    <AppShell>
      <AppShell.Sidebar>
        <AppShell.Brand title="Guild Manager" subtitle="World of Warcraft" initials="GM" />
        <AppShell.Nav label="Main">
          <AppShell.NavItem to="/" icon="dashboard" end>
            Dashboard
          </AppShell.NavItem>
          <AppShell.NavItem to="/events" icon="events">
            Events
          </AppShell.NavItem>
          <AppShell.NavItem to="/roster" icon="roster">
            Roster
          </AppShell.NavItem>
          <AppShell.NavItem to="/registrations" icon="registrations">
            Pending registrations
          </AppShell.NavItem>
          <AppShell.NavItem to="/attendance" icon="report">
            Attendance report
          </AppShell.NavItem>
          <AppShell.NavSeparator />
          <AppShell.NavItem to="/settings/guild" icon="guildSettings">
            Guild settings
          </AppShell.NavItem>
          <AppShell.NavItem to="/settings/user" icon="user">
            User settings
          </AppShell.NavItem>
          <AppShell.NavItem to="/status" icon="status">
            System status
          </AppShell.NavItem>
        </AppShell.Nav>
      </AppShell.Sidebar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
