import type { MeResponse } from '@wgm/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ashenId,
  emberwatchId,
  mockApi,
  testGuild,
  testUser,
  userWithoutGuild,
} from '../../test/api';
import { renderRoute } from '../../test/render';
import { choose } from '../../test/select';

const twoGuilds: MeResponse = {
  ...testUser,
  guilds: [
    { id: ashenId, name: 'Ashen Vanguard', imageUrl: null, access: 'guild_master' },
    { id: emberwatchId, name: 'Emberwatch', imageUrl: null, access: 'officer' },
  ],
};

const emberwatch = { ...testGuild, id: emberwatchId, name: 'Emberwatch', access: 'officer' };

beforeEach(() => {
  localStorage.clear();
});

describe('guild access', () => {
  it('opens the only guild a user has', async () => {
    mockApi();

    renderRoute('/');

    // The page is redrawn on the way, so wait until it settles on the right guild.
    await waitFor(() =>
      expect(screen.getByRole('complementary', { name: 'Ashen Vanguard' })).toBeInTheDocument(),
    );
  });

  it('shows the no-access page to a user without any guild', async () => {
    mockApi({ '/api/me': () => Response.json(userWithoutGuild) });

    renderRoute('/');

    expect(
      await screen.findByRole('heading', { name: "You don't have access to Guild Manager" }),
    ).toBeInTheDocument();
    expect(screen.getByText('Logged in as Thrall')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a new guild' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in with a different account' })).toBeVisible();
  });

  it("doesn't offer to create a guild to someone who already leads one", async () => {
    mockApi({ '/api/me': () => Response.json({ ...userWithoutGuild, canCreateGuild: false }) });

    renderRoute('/no-access');

    await screen.findByRole('heading', { name: "You don't have access to Guild Manager" });
    expect(screen.queryByRole('link', { name: 'Create a new guild' })).not.toBeInTheDocument();
  });

  it('lets a user with several guilds choose one, then remembers it', async () => {
    mockApi({
      '/api/me': () => Response.json(twoGuilds),
      [`/api/guilds/${emberwatchId}`]: () => Response.json(emberwatch),
    });
    const user = userEvent.setup();
    const { unmount } = renderRoute('/');

    expect(await screen.findByRole('heading', { name: 'Choose a guild' })).toBeInTheDocument();
    expect(screen.getByText('You: Officer')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /Emberwatch/ }));
    expect(await screen.findByRole('complementary', { name: 'Emberwatch' })).toBeInTheDocument();
    unmount();

    renderRoute('/');
    expect(await screen.findByRole('complementary', { name: 'Emberwatch' })).toBeInTheDocument();
  });

  it('switches guild from the sidebar', async () => {
    mockApi({
      '/api/me': () => Response.json(twoGuilds),
      [`/api/guilds/${emberwatchId}`]: () => Response.json(emberwatch),
    });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/dashboard`);
    await screen.findByRole('complementary', { name: 'Ashen Vanguard' });

    await choose(user, screen.getByRole('combobox', { name: 'Switch guild' }), 'Emberwatch');

    expect(await screen.findByRole('complementary', { name: 'Emberwatch' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Roster' })).toHaveAttribute(
      'href',
      `/guilds/${emberwatchId}/roster`,
    );
  });

  it("sends a user away from a guild they can't open", async () => {
    mockApi();

    renderRoute(`/guilds/${emberwatchId}/dashboard`);

    // The page is redrawn on the way, so wait until it settles on the right guild.
    await waitFor(() =>
      expect(screen.getByRole('complementary', { name: 'Ashen Vanguard' })).toBeInTheDocument(),
    );
  });

  it('drops a guild once the API says the user lost access to it', async () => {
    let me: MeResponse = twoGuilds;
    mockApi({
      '/api/me': () => Response.json(me),
      // The Officer role was removed in Discord: the dashboard's request is refused.
      [`/api/guilds/${emberwatchId}/dashboard`]: () => {
        me = { ...testUser };
        return Response.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
      },
    });

    renderRoute(`/guilds/${emberwatchId}/dashboard`);

    // The page is redrawn on the way, so wait until it settles on the right guild.
    await waitFor(() =>
      expect(screen.getByRole('complementary', { name: 'Ashen Vanguard' })).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.queryByRole('combobox', { name: 'Switch guild' })).not.toBeInTheDocument(),
    );
  });
});
