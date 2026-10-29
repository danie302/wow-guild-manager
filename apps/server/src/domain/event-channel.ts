import type { EventType } from '@wgm/shared';

import type { Guild } from '../db/models/index.js';

/** The guild's channel for each event type (null when the type has none). */
export function typeChannelIds(
  guild: Pick<Guild, 'raidChannelId' | 'dungeonChannelId' | 'pvpChannelId'>,
): Record<EventType, string | null> {
  return { raid: guild.raidChannelId, dungeon: guild.dungeonChannelId, pvp: guild.pvpChannelId };
}

/**
 * Where an event is posted: its series' channel, else its type's, else the guild's events
 * channel. Null when none is set, so the event has no post.
 */
export function eventChannelId(
  guild: Pick<Guild, 'eventsChannelId' | 'raidChannelId' | 'dungeonChannelId' | 'pvpChannelId'>,
  type: EventType,
  seriesChannelId: string | null = null,
): string | null {
  return seriesChannelId ?? typeChannelIds(guild)[type] ?? guild.eventsChannelId;
}
