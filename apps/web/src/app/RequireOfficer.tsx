import { Navigate, Outlet } from 'react-router';

import { guildPath, useGuildAccess, useGuildIdParam } from './guildSelection';

/**
 * Pages only the Guild Master and Officers open (dashboard, settings, reports, forms). A
 * read-only member goes to the events instead; the server refuses them anyway.
 */
export function RequireOfficer() {
  const guildId = useGuildIdParam();
  return useGuildAccess() === 'member' && guildId ? (
    <Navigate to={guildPath(guildId, 'events')} replace />
  ) : (
    <Outlet />
  );
}
