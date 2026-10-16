import type { RouteObject } from 'react-router';

import { PlaceholderPage } from '../pages/PlaceholderPage';
import { StatusPage } from '../pages/StatusPage';
import { Layout } from './Layout';

// Placeholder pages until their stories build them. English text moves to translations in story 035.
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <PlaceholderPage title="Dashboard" /> },
      { path: 'events', element: <PlaceholderPage title="Events" /> },
      { path: 'roster', element: <PlaceholderPage title="Roster" /> },
      { path: 'registrations', element: <PlaceholderPage title="Pending registrations" /> },
      { path: 'attendance', element: <PlaceholderPage title="Attendance report" /> },
      { path: 'settings/guild', element: <PlaceholderPage title="Guild settings" /> },
      { path: 'settings/user', element: <PlaceholderPage title="User settings" /> },
      { path: 'status', element: <StatusPage /> },
      { path: '*', element: <PlaceholderPage title="Page not found" /> },
    ],
  },
];
