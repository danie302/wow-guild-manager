import type { RouteObject } from 'react-router';

import { DashboardPage } from '../pages/DashboardPage';
import { GuildSetupPage } from '../pages/GuildSetupPage';
import { LoginPage } from '../pages/LoginPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { StatusPage } from '../pages/StatusPage';
import { UserSettingsPage } from '../pages/UserSettingsPage';
import { HomeRedirect } from './HomeRedirect';
import { Layout } from './Layout';
import { RequireAuth } from './RequireAuth';

// Placeholder pages until their stories build them.
export const routes: RouteObject[] = [
  { path: 'login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <HomeRedirect /> },
      // Full screen, outside the app shell.
      { path: 'setup', element: <GuildSetupPage /> },
      {
        element: <Layout />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'events', element: <PlaceholderPage titleKey="nav.events" /> },
          { path: 'roster', element: <PlaceholderPage titleKey="nav.roster" /> },
          { path: 'registrations', element: <PlaceholderPage titleKey="nav.registrations" /> },
          { path: 'attendance', element: <PlaceholderPage titleKey="nav.attendance" /> },
          { path: 'settings/guild', element: <PlaceholderPage titleKey="nav.guildSettings" /> },
          { path: 'settings/user', element: <UserSettingsPage /> },
          { path: 'status', element: <StatusPage /> },
          { path: '*', element: <PlaceholderPage titleKey="pages.notFound" /> },
        ],
      },
    ],
  },
];
