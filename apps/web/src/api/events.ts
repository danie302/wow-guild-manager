import { useQuery } from '@tanstack/react-query';
import type { EventResponse } from '@wgm/shared';

import { apiRequest } from './client';

export const eventsKey = (guildId: string) => ['guilds', guildId, 'events'] as const;

/** Which events to list: upcoming or past, or those starting in a UTC range. */
export type EventsQuery = { scope: 'upcoming' | 'past' } | { from: string; to: string };

export function useEvents(guildId: string, query: EventsQuery) {
  return useQuery({
    queryKey: [...eventsKey(guildId), 'list', query],
    queryFn: () =>
      apiRequest<EventResponse[]>(
        `/guilds/${guildId}/events?${new URLSearchParams(query).toString()}`,
      ),
  });
}
