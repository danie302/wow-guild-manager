import { Navigate, type RouteObject } from 'react-router';

import { DashboardPage } from '../pages/DashboardPage';
import { GuildPickerPage } from '../pages/GuildPickerPage';
import { GuildSettingsPage } from '../pages/GuildSettingsPage';
import { GuildSetupPage } from '../pages/GuildSetupPage';
import { LoginPage } from '../pages/LoginPage';
import { NoAccessPage } from '../pages/NoAccessPage';
import { EventsPage } from '../pages/events/EventsPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { RegistrationsPage } from '../pages/registrations/RegistrationsPage';
import { MemberPage } from '../pages/roster/MemberPage';
import { RosterPage } from '../pages/roster/RosterPage';
import { StatusPage } from '../pages/StatusPage';
import { UserSettingsPage } from '../pages/UserSettingsPage';
import { GuildRoute } from './GuildRoute';
import { HomeRedirect } from './HomeRedirect';
import { Layout } from './Layout';
import { RequireAuth } from './RequireAuth';

// Placeholder pages until their stories build them. A guild's pages are under /guilds/:guildId.
export const routes: RouteObject[] = [
  { path: 'login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: <HomeRedirect /> },
      // Full screen, outside the app shell.
      { path: 'setup', element: <GuildSetupPage /> },
      { path: 'no-access', element: <NoAccessPage /> },
      { path: 'guilds', element: <GuildPickerPage /> },
      {
        element: <Layout />,
        children: [
          {
            path: 'guilds/:guildId',
            element: <GuildRoute />,
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              { path: 'dashboard', element: <DashboardPage /> },
              { path: 'events', element: <EventsPage /> },
              // Built in story 020, part 3.
              { path: 'events/new', element: <PlaceholderPage titleKey="events.new" /> },
              { path: 'events/:eventId', element: <PlaceholderPage titleKey="events.title" /> },
              { path: 'roster', element: <RosterPage /> },
              { path: 'roster/:memberId', element: <MemberPage /> },
              { path: 'registrations', element: <RegistrationsPage /> },
              { path: 'attendance', element: <PlaceholderPage titleKey="nav.attendance" /> },
              { path: 'settings', element: <GuildSettingsPage /> },
            ],
          },
          { path: 'settings/user', element: <UserSettingsPage /> },
          { path: 'status', element: <StatusPage /> },
          { path: '*', element: <PlaceholderPage titleKey="pages.notFound" /> },
        ],
      },
    ],
  },
];
