import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router';

import { useMe } from '../api/me';
import { rememberGuild, useGuildIdParam } from './guildSelection';

/**
 * The pages of the guild in the URL. A guild the user can't open (or no longer can, e.g. after
 * losing the Officer role) sends them home, which picks another one.
 */
export function GuildRoute() {
  const guildId = useGuildIdParam();
  const guilds = useMe().data?.guilds ?? [];
  const allowed = guilds.some((guild) => guild.id === guildId);

  useEffect(() => {
    if (allowed && guildId !== undefined) rememberGuild(guildId);
  }, [allowed, guildId]);

  return allowed ? <Outlet /> : <Navigate to="/" replace />;
}
