import { Navigate } from 'react-router';

import { useMe } from '../api/me';

/**
 * Where "/" (and the end of the login) leads: the dashboard for a user with a guild, and the
 * guild setup for everyone else. Story 014 sends users without access to the no-access page.
 */
export function HomeRedirect() {
  const me = useMe().data;
  return <Navigate to={me && me.guilds.length > 0 ? '/dashboard' : '/setup'} replace />;
}
