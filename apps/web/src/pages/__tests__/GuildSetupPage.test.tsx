import type { DiscordServersResponse, MeResponse } from '@wgm/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ashenId, mockApi, testGuild, userWithoutGuild } from '../../test/api';
import { renderRoute } from '../../test/render';

const servers: DiscordServersResponse = {
  botInviteUrl: 'https://discord.test/invite',
  servers: [
    { id: '300000000000000001', name: 'Ashen Vanguard Discord', iconUrl: null, available: true },
    { id: '300000000000000002', name: 'Emberwatch', iconUrl: null, available: false },
  ],
};

const roles = {
  roles: [
    { id: '400000000000000001', name: 'Officers', color: '#c8a14a' },
    { id: '400000000000000002', name: 'Raiders', color: null },
  ],
};

/** A fake API for a user without a guild, who gets one once POST /api/guilds succeeds. */
function mockSetupApi(overrides: Parameters<typeof mockApi>[0] = {}) {
  let me: MeResponse = userWithoutGuild;
  return mockApi({
    '/api/me': () => Response.json(me),
    '/api/discord/servers': () => Response.json(servers),
    '/api/discord/servers/300000000000000001/roles': () => Response.json(roles),
    'POST /api/guilds': () => {
      me = {
        ...userWithoutGuild,
        guilds: [{ id: ashenId, name: testGuild.name, imageUrl: null, access: 'guild_master' }],
        canCreateGuild: false,
      };
      return Response.json(testGuild, { status: 201 });
    },
    ...overrides,
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

describe('GuildSetupPage', () => {
  it('opens from the no-access page', async () => {
    mockSetupApi();
    renderRoute('/no-access');

    expect(await screen.findByRole('link', { name: 'Create a new guild' })).toHaveAttribute(
      'href',
      '/setup',
    );
  });

  it('creates the guild in one request at the last step, then opens the dashboard', async () => {
    const fetchMock = mockSetupApi();
    const user = userEvent.setup();
    renderRoute('/setup');

    await user.type(await screen.findByLabelText('Guild name'), '  Ashen Vanguard ');
    await user.click(screen.getByRole('radio', { name: 'Horde' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add the bot to a Discord server' })).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(screen.getByRole('radio', { name: /Emberwatch/ })).toBeDisabled();
    expect(screen.getByText('Already connected to another guild')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /Ashen Vanguard Discord/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(
      await screen.findByRole('combobox', { name: 'Discord role that grants Officer' }),
    );
    await user.click(await screen.findByRole('option', { name: 'Officers' }));
    expect(screen.getByText(/can manage the guild in this app/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/guilds', expect.anything());
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));

    expect(await screen.findByRole('heading', { name: 'Ashen Vanguard' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/guilds',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Ashen Vanguard',
          faction: 'horde',
          discordServerId: '300000000000000001',
          officerRoleId: '400000000000000001',
        }),
      }),
    );
    expect(sessionStorage.length).toBe(0);
  });

  it("doesn't continue with an empty or offensive name", async () => {
    mockSetupApi();
    const user = userEvent.setup();
    renderRoute('/setup');

    expect(await screen.findByRole('button', { name: 'Continue' })).toBeDisabled();
    await user.type(screen.getByLabelText('Guild name'), 'Los Pendejos');

    expect(screen.getByLabelText('Guild name')).toHaveAccessibleDescription(
      "This name contains a word that isn't allowed.",
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('remembers the steps already done when the page is opened again', async () => {
    mockSetupApi();
    const user = userEvent.setup();
    const { unmount } = renderRoute('/setup');
    await user.type(await screen.findByLabelText('Guild name'), 'Ashen Vanguard');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Step 2 of 3');
    unmount();

    renderRoute('/setup');
    expect(await screen.findByText('Step 2 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Guild name')).toHaveValue('Ashen Vanguard');
  });

  it('explains what to do when the bot is in no server the user manages', async () => {
    mockSetupApi({ '/api/discord/servers': () => Response.json({ ...servers, servers: [] }) });
    sessionStorage.setItem('wgm.guildSetup', JSON.stringify({ step: 1, name: 'Ashen Vanguard' }));

    renderRoute('/setup');

    expect(await screen.findByText(/No servers yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it("says Discord isn't set up when the server has no bot token", async () => {
    mockSetupApi({
      '/api/discord/servers': () =>
        Response.json({ error: { code: 'DISCORD_NOT_CONFIGURED' } }, { status: 503 }),
    });
    sessionStorage.setItem('wgm.guildSetup', JSON.stringify({ step: 1, name: 'Ashen Vanguard' }));

    renderRoute('/setup');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Discord isn't set up/);
  });

  it('shows why the guild could not be created', async () => {
    mockSetupApi({
      'POST /api/guilds': () =>
        Response.json({ error: { code: 'DISCORD_SERVER_TAKEN' } }, { status: 409 }),
    });
    sessionStorage.setItem(
      'wgm.guildSetup',
      JSON.stringify({
        step: 2,
        name: 'Ashen Vanguard',
        serverId: '300000000000000001',
        roleId: '400000000000000001',
      }),
    );
    const user = userEvent.setup();
    renderRoute('/setup');

    await user.click(await screen.findByRole('button', { name: 'Finish setup' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That Discord server is already connected to another guild.',
    );
  });

  it('sends a user who already leads a guild to the dashboard', async () => {
    mockApi();

    renderRoute('/setup');

    expect(await screen.findByRole('heading', { name: 'Ashen Vanguard' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Set up your guild')).not.toBeInTheDocument());
  });
});
