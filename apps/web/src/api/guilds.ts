import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateGuildInput,
  DashboardResponse,
  TransferCandidate,
  DiscordChannelsResponse,
  DiscordRolesResponse,
  DiscordServersResponse,
  GuildDiscordInput,
  GuildResponse,
  Locale,
} from '@wgm/shared';

import { apiRequest } from './client';

/** The guild's settings; `enabled` false skips it, e.g. for read-only members, who can't read them. */
export function useGuild(guildId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['guilds', guildId],
    queryFn: () => apiRequest<GuildResponse>(`/guilds/${guildId}`),
    enabled: enabled && guildId !== undefined,
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

/** The text channels of a server where the bot can post events. */
export function useDiscordChannels(serverId: string | null) {
  return useQuery({
    queryKey: ['discord', 'servers', serverId, 'channels'],
    queryFn: () => apiRequest<DiscordChannelsResponse>(`/discord/servers/${serverId}/channels`),
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

/** The guild settings page's changes. Only what changed is sent. */
export interface GuildSettingsChanges {
  name?: string;
  /** A new image file, or null to remove the image. */
  image?: File | null;
  discord?: GuildDiscordInput;
  eventsChannelId?: string;
  discordLocale?: Locale;
  tentativeDeadlineHours?: number;
  reminderHours?: number;
  attendanceGoodThreshold?: number;
  attendanceRiskThreshold?: number;
}

/** Saves every change in one request, so they all apply or none does. */
export function useSaveGuildSettings(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: GuildSettingsChanges) => {
      const form = new FormData();
      if (changes.name !== undefined) form.set('name', changes.name);
      if (changes.image) form.set('image', changes.image);
      if (changes.image === null) form.set('removeImage', 'true');
      if (changes.discord) {
        form.set('discordServerId', changes.discord.discordServerId);
        form.set('officerRoleId', changes.discord.officerRoleId);
      }
      if (changes.eventsChannelId) form.set('eventsChannelId', changes.eventsChannelId);
      if (changes.discordLocale) form.set('discordLocale', changes.discordLocale);
      if (changes.tentativeDeadlineHours !== undefined) {
        form.set('tentativeDeadlineHours', String(changes.tentativeDeadlineHours));
      }
      if (changes.reminderHours !== undefined) {
        form.set('reminderHours', String(changes.reminderHours));
      }
      if (changes.attendanceGoodThreshold !== undefined) {
        form.set('attendanceGoodThreshold', String(changes.attendanceGoodThreshold));
      }
      if (changes.attendanceRiskThreshold !== undefined) {
        form.set('attendanceRiskThreshold', String(changes.attendanceRiskThreshold));
      }
      return apiRequest<GuildResponse>(`/guilds/${guildId}`, { method: 'PATCH', body: form });
    },
    onSuccess: async (guild) => {
      queryClient.setQueryData(['guilds', guildId], guild);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      // Event pages preview the posts in the guild's channel and language.
      await queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'events'] });
    },
  });
}

/** Who the Guild Master can hand the guild to. */
export function useTransferCandidates(guildId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['guilds', guildId, 'transfer-candidates'],
    queryFn: () => apiRequest<TransferCandidate[]>(`/guilds/${guildId}/transfer-candidates`),
    enabled,
  });
}

/** The guild changes hands or goes away: the user's guilds and access reload. */
function useLeadershipMutation<Input>(guildId: string, request: (input: Input) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.invalidateQueries({ queryKey: ['guilds', guildId] });
    },
  });
}

export function useTransferLeadership(guildId: string) {
  return useLeadershipMutation(guildId, (memberId: string) =>
    apiRequest<void>(`/guilds/${guildId}/transfer`, { method: 'POST', body: { memberId } }),
  );
}

export function useDisbandGuild(guildId: string) {
  return useLeadershipMutation(guildId, (name: string) =>
    apiRequest<void>(`/guilds/${guildId}/disband`, { method: 'POST', body: { name } }),
  );
}

/** What needs the Guild Master's and Officers' attention. */
export function useDashboard(guildId: string) {
  return useQuery({
    queryKey: ['guilds', guildId, 'dashboard'],
    queryFn: () => apiRequest<DashboardResponse>(`/guilds/${guildId}/dashboard`),
  });
}
