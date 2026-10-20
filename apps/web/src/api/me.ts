import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Locale, MeResponse } from '@wgm/shared';

import { ApiRequestError, apiRequest } from './client';

const meKey = ['me'] as const;

/** The logged-in user, or null when nobody is logged in. */
export async function fetchMe(): Promise<MeResponse | null> {
  try {
    return await apiRequest<MeResponse>('/me');
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: fetchMe, staleTime: 5 * 60 * 1000, retry: false });
}

/** Saves the user's language, so it follows them to other devices. */
export function useSaveLocale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (locale: Locale) =>
      apiRequest<MeResponse>('/me', { method: 'PATCH', body: { locale } }),
    onSuccess: (me) => queryClient.setQueryData(meKey, me),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      // Mark the user as logged out (the route guard reacts to it), then drop the rest of
      // their cached data.
      queryClient.setQueryData(meKey, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meKey[0] });
    },
  });
}

/** Where the login button sends the browser. The API redirects on to Discord. */
export function discordLoginUrl(locale: Locale): string {
  return `/api/auth/discord/login?locale=${locale}`;
}
