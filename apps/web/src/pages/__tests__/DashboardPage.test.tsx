import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi, testGuild } from '../../test/api';
import { renderRoute } from '../../test/render';

describe('DashboardPage', () => {
  it("shows the guild's faction, Discord server, and Officer role", async () => {
    mockApi();

    renderRoute(`/guilds/${ashenId}/dashboard`);

    expect(await screen.findByRole('heading', { name: 'Ashen Vanguard' })).toBeInTheDocument();
    expect(screen.getByText('Alliance')).toBeInTheDocument();
    expect(screen.getByText('Ashen Vanguard Discord')).toBeInTheDocument();
    expect(screen.getByText('Officers')).toBeInTheDocument();
  });

  it("still shows the guild when Discord can't be read", async () => {
    mockApi({
      [`/api/guilds/${ashenId}`]: () =>
        Response.json({
          ...testGuild,
          discordServer: { ...testGuild.discordServer, name: null },
          officerRole: { ...testGuild.officerRole, name: null },
        }),
    });

    renderRoute(`/guilds/${ashenId}/dashboard`);

    expect(await screen.findByRole('heading', { name: 'Ashen Vanguard' })).toBeInTheDocument();
    expect(screen.getAllByText("Can't be read from Discord right now")).toHaveLength(2);
  });
});
