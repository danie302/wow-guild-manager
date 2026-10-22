import { uuidSchema, type GuildAccess, type MeGuild } from '@wgm/shared';
import { useParams } from 'react-router';

import { useMe } from '../api/me';

const storageKey = 'wgm.lastGuild';

/** Remembers the guild the user last opened, to go straight to it next time. */
export function rememberGuild(guildId: string): void {
  try {
    localStorage.setItem(storageKey, guildId);
  } catch {
    // Without storage, users with several guilds just pick again.
  }
}

/** The guild the user last opened, if they can still open it. */
export function lastGuild(guilds: readonly MeGuild[]): MeGuild | undefined {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(storageKey);
  } catch {
    return undefined;
  }
  return guilds.find((guild) => guild.id === saved);
}

/** The guild in the URL (`/guilds/:guildId/...`), or undefined outside a guild's pages. */
export function useGuildIdParam(): string | undefined {
  const { guildId } = useParams();
  return uuidSchema.safeParse(guildId).success ? guildId : undefined;
}

/** A guild page's URL, e.g. guildPath(id, 'roster') → "/guilds/<id>/roster". */
export function guildPath(guildId: string, page: string): string {
  return `/guilds/${guildId}/${page}`;
}

/**
 * The user's access to the guild in the URL, from their guild list: no extra request, and it
 * works for read-only members, who can't load the guild's settings.
 */
export function useGuildAccess(): GuildAccess | undefined {
  const guildId = useGuildIdParam();
  return useMe().data?.guilds.find((guild) => guild.id === guildId)?.access;
}
