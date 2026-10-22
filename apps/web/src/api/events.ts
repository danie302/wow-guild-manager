import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateEventInput,
  EventDiscordPostResponse,
  EventResponse,
  SeriesResponse,
  SeriesSignUpsResponse,
  SignUpResponse,
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

/** The message the bot posts for the event, built by the same code as the real post. */
export function useEventDiscordPost(guildId: string, eventId: string) {
  return useQuery({
    queryKey: [...eventKey(guildId, eventId), 'discord-post'],
    queryFn: () =>
      apiRequest<EventDiscordPostResponse>(`/guilds/${guildId}/events/${eventId}/discord-post`),
  });
}

/** The event's sign-ups, in sign-up order. */
export function useEventSignUps(guildId: string, eventId: string) {
  return useQuery({
    queryKey: [...eventKey(guildId, eventId), 'sign-ups'],
    queryFn: () => apiRequest<SignUpResponse[]>(`/guilds/${guildId}/events/${eventId}/sign-ups`),
    enabled: eventId !== '',
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
      await queryClient.invalidateQueries({
        queryKey: [...eventKey(guildId, event.id), 'discord-post'],
      });
      await queryClient.invalidateQueries({
        queryKey: [...eventKey(guildId, event.id), 'sign-ups'],
      });
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

/** The sign-ups of each of the series' future events. */
export function useSeriesSignUps(guildId: string, seriesId: string) {
  return useQuery({
    queryKey: [...seriesKey(guildId), seriesId, 'sign-ups'],
    queryFn: () =>
      apiRequest<SeriesSignUpsResponse>(`/guilds/${guildId}/series/${seriesId}/sign-ups`),
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
        queryClient.invalidateQueries({ queryKey: [...seriesKey(guildId), series.id, 'sign-ups'] }),
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
