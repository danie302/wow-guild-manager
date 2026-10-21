import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateEventInput, EventResponse, UpdateEventInput } from '@wgm/shared';

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

const eventKey = (guildId: string, eventId: string) => [...eventsKey(guildId), eventId] as const;

export function useEvent(guildId: string, eventId: string) {
  return useQuery({
    queryKey: eventKey(guildId, eventId),
    queryFn: () => apiRequest<EventResponse>(`/guilds/${guildId}/events/${eventId}`),
  });
}

/** Every change answers with the event, which replaces the cached one; the lists reload. */
function useEventMutation<Input>(
  guildId: string,
  request: (input: Input) => Promise<EventResponse>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: async (event) => {
      queryClient.setQueryData(eventKey(guildId, event.id), event);
      await queryClient.invalidateQueries({ queryKey: [...eventsKey(guildId), 'list'] });
    },
  });
}

export function useCreateEvent(guildId: string) {
  return useEventMutation(guildId, (input: CreateEventInput) =>
    apiRequest<EventResponse>(`/guilds/${guildId}/events`, { method: 'POST', body: input }),
  );
}

export function useUpdateEvent(guildId: string, eventId: string) {
  return useEventMutation(guildId, (input: UpdateEventInput) =>
    apiRequest<EventResponse>(`/guilds/${guildId}/events/${eventId}`, {
      method: 'PUT',
      body: input,
    }),
  );
}

export function useCancelEvent(guildId: string, eventId: string) {
  return useEventMutation(guildId, () =>
    apiRequest<EventResponse>(`/guilds/${guildId}/events/${eventId}/cancel`, { method: 'POST' }),
  );
}
