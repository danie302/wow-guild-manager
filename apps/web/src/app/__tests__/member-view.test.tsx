import type { EventResponse, MeResponse, MemberDetailResponse, RosterMember } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi, testUser } from '../../test/api';
import { renderRoute } from '../../test/render';

const member: MeResponse = {
  ...testUser,
  guilds: [{ id: ashenId, name: 'Ashen Vanguard', imageUrl: null, access: 'member' }],
};
const eventId = '019a0c3e-5b1e-7c2a-9f3d-000000000501';
const nextYear = new Date().getUTCFullYear() + 1;
const event: EventResponse = {
  id: eventId,
  type: 'raid',
  name: 'Molten Core',
  description: '',
  startsAt: `${nextYear}-11-10T19:00:00.000Z`,
  size: 40,
  slots: { tank: 4, healer: 10, dps: 26 },
  createdBy: 'Thrall',
  cancelled: null,
  series: null,
  tentativeDeadline: { at: `${nextYear}-11-09T19:00:00.000Z`, hours: 24, own: false },
  discordPost: { url: 'https://discord.com/channels/3/5/6', error: null },
};
const rosterMember = (id: string, name: string, discordUserId: string): RosterMember => ({
  id,
  discordUserId,
  discordName: name,
  avatarUrl: '',
  rank: 'raider',
  baseRank: 'raider',
  characters: [],
  leftDiscordAt: null,
  attendanceRate: null,
  attendanceBand: null,
});
const me = rosterMember('m-me', 'Thrall', testUser.discordId);
const other = rosterMember('m-other', 'Jaina', '200000000000000999');

function api() {
  mockApi({
    '/api/me': () => Response.json(member),
    [`/api/guilds/${ashenId}/events`]: () => Response.json([event]),
    [`/api/guilds/${ashenId}/events/${eventId}`]: () => Response.json(event),
    [`/api/guilds/${ashenId}/events/${eventId}/sign-ups`]: () => Response.json([]),
    [`/api/guilds/${ashenId}/members`]: () => Response.json([me, other]),
    [`/api/guilds/${ashenId}/members/m-me`]: () =>
      Response.json({ ...me, rankHistory: [], officerNotes: [] } satisfies MemberDetailResponse),
  });
}

describe('the member view', () => {
  it('lands on the events, with only the pages members can open', async () => {
    api();
    renderRoute('/');

    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Roster' })).toBeInTheDocument();
    for (const hidden of [
      'Dashboard',
      'Pending registrations',
      'Attendance report',
      'Guild settings',
    ]) {
      expect(within(nav).queryByRole('link', { name: hidden })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'New event' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Past' })).not.toBeInTheDocument();
  });

  it("sends them away from the officers' pages", async () => {
    api();
    renderRoute(`/guilds/${ashenId}/settings`);

    expect(await screen.findByRole('heading', { name: 'Events' })).toBeInTheDocument();
  });

  it('shows an event without actions, with a link to sign up in Discord', async () => {
    api();
    renderRoute(`/guilds/${ashenId}/events/${eventId}`);

    expect(await screen.findByText('Sign-ups happen in Discord')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the Discord post/ })).toHaveAttribute(
      'href',
      'https://discord.com/channels/3/5/6',
    );
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel event' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Attendance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Discord post' })).not.toBeInTheDocument();
  });

  it('shows the roster, opening only their own page, which has no actions', async () => {
    api();
    renderRoute(`/guilds/${ashenId}/roster`);

    const rows = within(await screen.findByRole('list', { name: 'Roster' })).getAllByRole(
      'listitem',
    );
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      `/guilds/${ashenId}/roster/m-me`,
      null,
    ]);
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Left Discord only')).not.toBeInTheDocument();
  });
});
