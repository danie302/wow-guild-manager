import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateEventInput,
  EventResponse,
  SeriesResponse,
  UpdateEventInput,
} from '@wgm/shared';

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

const seriesKey = (guildId: string) => ['guilds', guildId, 'series'] as const;

/** The running weekly series, soonest next event first. */
export function useSeriesList(guildId: string) {
  return useQuery({
    queryKey: [...seriesKey(guildId), 'list'],
    queryFn: () => apiRequest<SeriesResponse[]>(`/guilds/${guildId}/series`),
  });
}

export function useSeries(guildId: string, seriesId: string) {
  return useQuery({
    queryKey: [...seriesKey(guildId), seriesId],
    queryFn: () => apiRequest<SeriesResponse>(`/guilds/${guildId}/series/${seriesId}`),
    enabled: seriesId !== '',
  });
}

/** A series change also changes its events, so both reload. */
function useSeriesMutation<Input>(
  guildId: string,
  request: (input: Input) => Promise<SeriesResponse>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: async (series) => {
      queryClient.setQueryData([...seriesKey(guildId), series.id], series);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...seriesKey(guildId), 'list'] }),
        queryClient.invalidateQueries({ queryKey: eventsKey(guildId) }),
      ]);
    },
  });
}

export function useCreateSeries(guildId: string) {
  return useSeriesMutation(guildId, (input: CreateEventInput) =>
    apiRequest<SeriesResponse>(`/guilds/${guildId}/series`, { method: 'POST', body: input }),
  );
}

export function useUpdateSeries(guildId: string, seriesId: string) {
  return useSeriesMutation(guildId, (input: UpdateEventInput) =>
    apiRequest<SeriesResponse>(`/guilds/${guildId}/series/${seriesId}`, {
      method: 'PUT',
      body: input,
    }),
  );
}

export function useStopSeries(guildId: string, seriesId: string) {
  return useSeriesMutation(guildId, () =>
    apiRequest<SeriesResponse>(`/guilds/${guildId}/series/${seriesId}/stop`, { method: 'POST' }),
  );
}
