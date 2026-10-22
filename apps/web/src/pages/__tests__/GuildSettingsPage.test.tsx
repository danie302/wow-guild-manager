import type { GuildResponse, MeResponse } from '@wgm/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ashenId, mockApi, testGuild, testUser } from '../../test/api';
import { renderRoute } from '../../test/render';

const settingsPath = `/guilds/${ashenId}/settings`;
const roles = {
  roles: [
    { id: '400000000000000001', name: 'Officers', color: null },
    { id: '400000000000000002', name: 'Raid Leaders', color: null },
  ],
};

const channels = {
  channels: [
    { id: '500000000000000001', name: 'raid-signups', category: 'Raiding' },
    { id: '500000000000000002', name: 'announcements', category: null },
  ],
};

/** A fake API that keeps the guild and applies the settings save to it, like the server. */
function mockSettingsApi(start: GuildResponse = testGuild) {
  let guild = start;
  return mockApi({
    [`/api/guilds/${ashenId}`]: () => Response.json(guild),
    [`PATCH /api/guilds/${ashenId}`]: (init) => {
      const form = init?.body as FormData;
      const name = form.get('name');
      const roleId = form.get('officerRoleId');
      const role = roles.roles.find((option) => option.id === roleId);
      const channel = channels.channels.find((option) => option.id === form.get('eventsChannelId'));
      const discordLocale = form.get('discordLocale');
      guild = {
        ...guild,
        ...(typeof name === 'string' && { name }),
        ...(form.get('image') && { imageUrl: `/api/guilds/${ashenId}/image?v=2` }),
        ...(role && { officerRole: { id: role.id, name: role.name } }),
        ...(channel && { eventsChannel: { id: channel.id, name: channel.name } }),
        ...((discordLocale === 'en' || discordLocale === 'es') && { discordLocale }),
      };
      return Response.json(guild);
    },
    '/api/discord/servers/300000000000000001/roles': () => Response.json(roles),
    '/api/discord/servers/300000000000000001/channels': () => Response.json(channels),
    [`/api/guilds/${ashenId}/members`]: () => Response.json([]),
  });
}

/** The form data of the settings saves sent so far. */
function savesSent(fetchMock: ReturnType<typeof mockApi>): FormData[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => url === `/api/guilds/${ashenId}` && init?.method === 'PATCH')
    .map(([, init]) => init?.body as FormData);
}

beforeEach(() => {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:preview', revokeObjectURL: vi.fn() }),
  );
});

describe('GuildSettingsPage', () => {
  it('saves the name, image, and Officer role in one request', async () => {
    const fetchMock = mockSettingsApi();
    const user = userEvent.setup();
    renderRoute(settingsPath);
    const file = new File(['png'], 'crest.png', { type: 'image/png' });

    await user.type(await screen.findByLabelText('Guild name'), ' Reborn');
    await user.upload(screen.getByLabelText('Upload image'), file);
    const role = screen.getByRole('combobox', { name: 'Discord role that grants Officer' });
    await waitFor(() => expect(role).toBeEnabled());
    await user.click(role);
    await user.click(await screen.findByRole('option', { name: 'Raid Leaders' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('All changes saved');
    const saves = savesSent(fetchMock);
    expect(saves).toHaveLength(1);
    expect(saves[0]!.get('name')).toBe('Ashen Vanguard Reborn');
    expect(saves[0]!.get('image')).toBe(file);
    expect(saves[0]!.get('officerRoleId')).toBe('400000000000000002');
  });

  it('saves a new name only when Save is pressed', async () => {
    const fetchMock = mockSettingsApi();
    const user = userEvent.setup();
    renderRoute(settingsPath);

    const name = await screen.findByLabelText('Guild name');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.clear(name);
    await user.type(name, 'Emberwatch');

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(savesSent(fetchMock)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('All changes saved')).toBeInTheDocument();
    expect([...savesSent(fetchMock)[0]!.entries()]).toEqual([['name', 'Emberwatch']]);
    expect(screen.getByLabelText('Guild name')).toHaveValue('Emberwatch');
  });

  it('discards unsaved changes', async () => {
    mockSettingsApi();
    const user = userEvent.setup();
    renderRoute(settingsPath);

    const name = await screen.findByLabelText('Guild name');
    await user.type(name, ' Reborn');
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(name).toHaveValue('Ashen Vanguard');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it("can't save an empty name", async () => {
    mockSettingsApi();
    const user = userEvent.setup();
    renderRoute(settingsPath);

    await user.clear(await screen.findByLabelText('Guild name'));

    expect(screen.getByText('Required.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('uploads a new image as the request body, and shows it in the header', async () => {
    const fetchMock = mockSettingsApi();
    const user = userEvent.setup();
    renderRoute(settingsPath);
    const file = new File(['png'], 'crest.png', { type: 'image/png' });

    await user.upload(await screen.findByLabelText('Upload image'), file);
    expect(screen.getByRole('img', { name: 'Guild image' })).toHaveAttribute('src', 'blob:preview');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('All changes saved');
    expect(savesSent(fetchMock)[0]!.get('image')).toBe(file);
  });

  it('rejects other file types and images over 5 MB before uploading', async () => {
    mockSettingsApi();
    const user = userEvent.setup({ applyAccept: false });
    renderRoute(settingsPath);
    const input = await screen.findByLabelText('Upload image');

    await user.upload(input, new File(['gif'], 'crest.gif', { type: 'image/gif' }));
    expect(screen.getByText('Use a PNG, JPEG, or WebP image.')).toBeInTheDocument();

    const huge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
    await user.upload(input, huge);
    expect(screen.getByText('The image is too big. Use one up to 5 MB.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('changes the Officer role', async () => {
    const fetchMock = mockSettingsApi();
    const user = userEvent.setup();
    renderRoute(settingsPath);

    const role = await screen.findByRole('combobox', { name: 'Discord role that grants Officer' });
    await waitFor(() => expect(role).toBeEnabled());
    await user.click(role);
    await user.click(await screen.findByRole('option', { name: 'Raid Leaders' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('All changes saved');
    expect([...savesSent(fetchMock)[0]!.entries()]).toEqual([
      ['discordServerId', '300000000000000001'],
      ['officerRoleId', '400000000000000002'],
    ]);
  });

  it('changes the events channel and the Discord language', async () => {
    const fetchMock = mockSettingsApi();
    const user = userEvent.setup();
    renderRoute(settingsPath);

    const channel = await screen.findByRole('combobox', { name: 'Events channel' });
    await waitFor(() => expect(channel).toBeEnabled());
    expect(channel).toHaveValue('#raid-signups · Raiding');
    await user.click(channel);
    await user.click(await screen.findByRole('option', { name: '#announcements' }));
    await user.click(screen.getByRole('button', { name: 'Español' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('All changes saved');
    expect([...savesSent(fetchMock)[0]!.entries()]).toEqual([
      ['eventsChannelId', '500000000000000002'],
      ['discordLocale', 'es'],
    ]);
    expect(screen.getByRole('combobox', { name: 'Events channel' })).toHaveValue('#announcements');
  });

  it('says events are not posted until a channel is chosen', async () => {
    mockSettingsApi({ ...testGuild, eventsChannel: null });
    renderRoute(settingsPath);

    expect(
      await screen.findByText("Events aren't posted in Discord until you choose a channel."),
    ).toBeInTheDocument();
  });

  it('saves the Tentative deadline and reminder', async () => {
    const fetchMock = mockSettingsApi();
    const user = userEvent.setup();
    renderRoute(settingsPath);

    const deadline = await screen.findByLabelText('Tentative deadline');
    await user.clear(deadline);
    await user.type(deadline, '200');
    expect(screen.getByText('Use 1–168 hours.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.clear(deadline);
    await user.type(deadline, '48');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(savesSent(fetchMock)).toHaveLength(1));
    expect([...savesSent(fetchMock)[0]!.entries()]).toEqual([['tentativeDeadlineHours', '48']]);
  });

  it('asks before leaving with unsaved changes', async () => {
    mockSettingsApi();
    const user = userEvent.setup();
    renderRoute(settingsPath);
    await user.type(await screen.findByLabelText('Guild name'), '!');

    await user.click(screen.getByRole('link', { name: 'Roster' }));
    const dialog = await screen.findByRole('dialog', { name: 'Leave without saving?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    // The page is hidden from screen readers until the dialog finishes closing.
    expect(await screen.findByLabelText('Guild name')).toHaveValue('Ashen Vanguard!');

    await user.click(await screen.findByRole('link', { name: 'Roster' }));
    await user.click(await screen.findByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('heading', { name: 'Roster' })).toBeInTheDocument();
  });

  it('shows the settings read-only to an Officer', async () => {
    const officer: MeResponse = {
      ...testUser,
      guilds: [{ id: ashenId, name: 'Ashen Vanguard', imageUrl: null, access: 'officer' }],
    };
    mockApi({
      '/api/me': () => Response.json(officer),
      [`/api/guilds/${ashenId}`]: () => Response.json({ ...testGuild, access: 'officer' }),
    });
    renderRoute(settingsPath);

    expect(await screen.findByLabelText('Guild name')).toBeDisabled();
    expect(screen.getAllByText('Only the Guild Master can change these.')).toHaveLength(2);
    expect(screen.queryByLabelText('Upload image')).not.toBeInTheDocument();
    // Officers can only change the sign-up settings.
    expect(screen.getByLabelText('Tentative deadline')).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Discord role that grants Officer' })).toHaveValue(
      'Officers',
    );
    expect(screen.getByRole('combobox', { name: 'Events channel' })).toHaveValue('#raid-signups');
    expect(screen.getByRole('button', { name: 'English' })).toBeDisabled();
  });
});
