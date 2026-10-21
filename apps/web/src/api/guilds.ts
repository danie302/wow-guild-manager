import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateGuildInput,
  DiscordRolesResponse,
  DiscordServersResponse,
  GuildResponse,
} from '@wgm/shared';

import { apiRequest } from './client';

export function useGuild(guildId: number | undefined) {
  return useQuery({
    queryKey: ['guilds', guildId],
    queryFn: () => apiRequest<GuildResponse>(`/guilds/${guildId}`),
    enabled: guildId !== undefined,
  });
}

/**
 * The Discord servers the user can connect. It reloads whenever the window gets focus, so a
 * server shows up when the user comes back from adding the bot in another tab.
 */
export function useDiscordServers(enabled: boolean) {
  return useQuery({
    queryKey: ['discord', 'servers'],
    queryFn: () => apiRequest<DiscordServersResponse>('/discord/servers'),
    enabled,
    refetchOnWindowFocus: 'always',
  });
}

/** The roles of a server that can grant Officer. */
export function useDiscordRoles(serverId: string | null) {
  return useQuery({
    queryKey: ['discord', 'servers', serverId, 'roles'],
    queryFn: () => apiRequest<DiscordRolesResponse>(`/discord/servers/${serverId}/roles`),
    enabled: serverId !== null,
    refetchOnWindowFocus: 'always',
  });
}

export function useCreateGuild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGuildInput) =>
      apiRequest<GuildResponse>('/guilds', { method: 'POST', body: input }),
    onSuccess: async (guild) => {
      queryClient.setQueryData(['guilds', guild.id], guild);
      // The user's guild list in /api/me now includes it.
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
