import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApproveRegistrationResponse, PendingRegistration } from '@wgm/shared';

import { apiRequest } from './client';

const registrationsKey = (guildId: string) => ['guilds', guildId, 'registrations'] as const;

/** Requests to join the roster, made with /register, waiting for the Guild Master or an Officer. */
export function useRegistrations(guildId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: registrationsKey(guildId),
    queryFn: () => apiRequest<PendingRegistration[]>(`/guilds/${guildId}/registrations`),
    enabled: enabled && guildId !== '',
  });
}

/** Approving adds to the roster, so it refreshes the roster too. */
function useReview<Result>(guildId: string, request: (id: string) => Promise<Result>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: registrationsKey(guildId) }),
        queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'members'] }),
      ]),
  });
}

export function useApproveRegistration(guildId: string) {
  return useReview(guildId, (id) =>
    apiRequest<ApproveRegistrationResponse>(`/guilds/${guildId}/registrations/${id}/approve`, {
      method: 'POST',
    }),
  );
}

export function useRejectRegistration(guildId: string) {
  return useReview(guildId, (id) =>
    apiRequest<void>(`/guilds/${guildId}/registrations/${id}/reject`, { method: 'POST' }),
  );
}
