import { Navigate } from 'react-router';

import { useMe } from '../api/me';
import { guildPath, lastGuild } from './guildSelection';

/**
 * Where "/" (and the end of the login) leads: the user's only guild, the guild they last
 * opened, the guild picker when they have several, or the no-access page when they have none.
 */
export function HomeRedirect() {
  const guilds = useMe().data?.guilds ?? [];
  const guild = guilds.length === 1 ? guilds[0] : lastGuild(guilds);
  if (guild) {
    return <Navigate to={guildPath(guild.id, 'dashboard')} replace />;
  }
  return <Navigate to={guilds.length > 0 ? '/guilds' : '/no-access'} replace />;
}
