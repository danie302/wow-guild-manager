import type { DashboardResponse } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi } from '../../test/api';
import { renderRoute } from '../../test/render';

const soon = new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString();

const data: DashboardResponse = {
  upcoming: [
    {
      id: 'e1',
      type: 'raid',
      name: 'Molten Core',
      startsAt: soon,
      size: 40,
      cancelled: false,
      slots: { tank: 4, healer: 10, dps: 26 },
      filled: { tank: 4, healer: 2, dps: 20 },
    },
  ],
  missingRoles: [
    {
      id: 'e1',
      name: 'Molten Core',
      startsAt: soon,
      size: 40,
      missing: { tank: 0, healer: 8, dps: 6 },
    },
  ],
  tentative: [
    {
      signUpId: 's1',
      eventId: 'e1',
      eventName: 'Molten Core',
      startsAt: soon,
      deadlineAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      character: { name: 'Jaina', class: 'mage' },
      role: 'dps',
    },
  ],
  registrations: [],
  leftDiscord: [
    {
      memberId: 'm1',
      discordName: 'Gone',
      rank: 'raider',
      main: { name: 'Rexxar', class: 'hunter' },
      leftAt: new Date().toISOString(),
    },
  ],
};

describe('DashboardPage', () => {
  it('shows the next events and what needs attention, each linking to its page', async () => {
    mockApi({ [`/api/guilds/${ashenId}/dashboard`]: () => Response.json(data) });

    renderRoute(`/guilds/${ashenId}/dashboard`);

    const upcoming = await screen.findByRole('list', { name: 'Upcoming events' });
    expect(within(upcoming).getAllByRole('listitem')[0]).toHaveAttribute(
      'href',
      `/guilds/${ashenId}/events/e1`,
    );
    expect(within(upcoming).getByText('26/40 signed up')).toBeInTheDocument();

    const missing = screen.getByRole('region', { name: 'Events missing roles' });
    expect(within(missing).getByText('8 Healers')).toBeInTheDocument();
    expect(within(missing).getByText('6 DPS')).toBeInTheDocument();

    const tentative = screen.getByRole('region', {
      name: 'Tentative sign-ups close to their deadline',
    });
    expect(within(tentative).getByText('Closes in 6 h')).toBeInTheDocument();

    const registrations = screen.getByRole('region', { name: 'Pending requests to join' });
    expect(within(registrations).getByText('Nothing to fix.')).toBeInTheDocument();

    const left = screen.getByRole('region', { name: 'Members who left the Discord server' });
    expect(within(left).getByRole('link')).toHaveAttribute('href', `/guilds/${ashenId}/roster/m1`);
  });
});
