import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddMemberInput,
  AttendancePeriod,
  AttendanceReportResponse,
  EventType,
  MemberAttendanceResponse,
  AddMemberResponse,
  BaseRank,
  CharacterInput,
  DiscordMemberOption,
  MemberDetailResponse,
  RosterMember,
} from '@wgm/shared';

import { apiRequest } from './client';

const rosterKey = (guildId: string) => ['guilds', guildId, 'members'] as const;
const memberKey = (guildId: string, memberId: string) => [...rosterKey(guildId), memberId] as const;

export function useRoster(guildId: string) {
  return useQuery({
    queryKey: rosterKey(guildId),
    queryFn: () => apiRequest<RosterMember[]>(`/guilds/${guildId}/members`),
  });
}

/** A member's attendance in a period. */
export function useMemberAttendance(guildId: string, memberId: string, period: AttendancePeriod) {
  return useQuery({
    queryKey: [...memberKey(guildId, memberId), 'attendance', period],
    queryFn: () =>
      apiRequest<MemberAttendanceResponse>(
        `/guilds/${guildId}/members/${memberId}/attendance?period=${period}`,
      ),
  });
}

/** Every member's attendance in a period and event type, to compare them. */
export function useAttendanceReport(
  guildId: string,
  period: AttendancePeriod,
  type: EventType | 'all',
) {
  return useQuery({
    queryKey: ['guilds', guildId, 'attendance', period, type],
    queryFn: () =>
      apiRequest<AttendanceReportResponse>(
        `/guilds/${guildId}/attendance?${new URLSearchParams({ period, type }).toString()}`,
      ),
  });
}

export function useMember(guildId: string, memberId: string) {
  return useQuery({
    queryKey: memberKey(guildId, memberId),
    queryFn: () => apiRequest<MemberDetailResponse>(`/guilds/${guildId}/members/${memberId}`),
  });
}

/** Server members whose name starts with `query` (2+ letters), for the add-member form. */
export function useDiscordMemberSearch(guildId: string, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['guilds', guildId, 'discord-members', trimmed.toLowerCase()],
    queryFn: () =>
      apiRequest<DiscordMemberOption[]>(
        `/guilds/${guildId}/discord-members?${new URLSearchParams({ query: trimmed }).toString()}`,
      ),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}

/** Every change to a member returns the member's page, which replaces the cached one. */
function useMemberMutation<Input>(
  guildId: string,
  request: (input: Input) => Promise<MemberDetailResponse | undefined>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: async (member) => {
      if (member) queryClient.setQueryData(memberKey(guildId, member.id), member);
      await queryClient.invalidateQueries({ queryKey: rosterKey(guildId), exact: true });
    },
  });
}

export function useAddMember(guildId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMemberInput) =>
      apiRequest<AddMemberResponse>(`/guilds/${guildId}/members`, { method: 'POST', body: input }),
    onSuccess: async ({ member }) => {
      queryClient.setQueryData(memberKey(guildId, member.id), member);
      await queryClient.invalidateQueries({ queryKey: rosterKey(guildId), exact: true });
    },
  });
}

export function useChangeRank(guildId: string, memberId: string) {
  return useMemberMutation(guildId, (rank: BaseRank) =>
    apiRequest<MemberDetailResponse>(`/guilds/${guildId}/members/${memberId}`, {
      method: 'PATCH',
      body: { rank },
    }),
  );
}

export function useAddCharacter(guildId: string, memberId: string) {
  return useMemberMutation(guildId, (character: CharacterInput) =>
    apiRequest<MemberDetailResponse>(`/guilds/${guildId}/members/${memberId}/characters`, {
      method: 'POST',
      body: character,
    }),
  );
}

export function useUpdateCharacter(guildId: string, memberId: string) {
  return useMemberMutation(
    guildId,
    ({ id, character }: { id: string; character: CharacterInput }) =>
      apiRequest<MemberDetailResponse>(`/guilds/${guildId}/members/${memberId}/characters/${id}`, {
        method: 'PUT',
        body: character,
      }),
  );
}

export function useRemoveCharacter(guildId: string, memberId: string) {
  return useMemberMutation(guildId, (id: string) =>
    apiRequest<MemberDetailResponse>(`/guilds/${guildId}/members/${memberId}/characters/${id}`, {
      method: 'DELETE',
    }),
  );
}

export function useSetMainCharacter(guildId: string, memberId: string) {
  return useMemberMutation(guildId, (characterId: string) =>
    apiRequest<MemberDetailResponse>(`/guilds/${guildId}/members/${memberId}/main`, {
      method: 'PUT',
      body: { characterId },
    }),
  );
}

export function useAddOfficerNote(guildId: string, memberId: string) {
  return useMemberMutation(guildId, (text: string) =>
    apiRequest<MemberDetailResponse>(`/guilds/${guildId}/members/${memberId}/notes`, {
      method: 'POST',
      body: { text },
    }),
  );
}

export function useRemoveMember(guildId: string, memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<void>(`/guilds/${guildId}/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: memberKey(guildId, memberId) });
      await queryClient.invalidateQueries({ queryKey: rosterKey(guildId), exact: true });
    },
  });
}
