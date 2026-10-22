import type { TransferCandidate } from '@wgm/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi, testGuild } from '../../test/api';
import { renderRoute } from '../../test/render';

const settingsPath = `/guilds/${ashenId}/settings`;
const candidates: TransferCandidate[] = [
  { memberId: '019a0c3e-5b1e-7c2a-9f3d-000000000701', discordName: 'Thrall', leads: null },
  { memberId: '019a0c3e-5b1e-7c2a-9f3d-000000000702', discordName: 'Jaina', leads: 'Theramore' },
];

function api() {
  return mockApi({
    [`/api/guilds/${ashenId}/transfer-candidates`]: () => Response.json(candidates),
    [`POST /api/guilds/${ashenId}/transfer`]: () => new Response(null, { status: 204 }),
    [`POST /api/guilds/${ashenId}/disband`]: () => new Response(null, { status: 204 }),
  });
}

const bodyOf = (fetchMock: ReturnType<typeof mockApi>, path: string) =>
  JSON.parse(
    fetchMock.mock.calls.find(([url]) => url === `/api/guilds/${ashenId}/${path}`)![1]!
      .body as string,
  ) as unknown;

describe('the danger zone', () => {
  it('transfers leadership after confirming, and leaves out members who lead a guild', async () => {
    const fetchMock = api();
    const user = userEvent.setup();
    renderRoute(settingsPath);

    const zone = await screen.findByRole('region', { name: 'Danger zone' });
    expect(await within(zone).findByText('Jaina – leads Theramore')).toBeInTheDocument();
    await user.click(within(zone).getByRole('combobox', { name: 'New Guild Master' }));
    expect(screen.queryByRole('option', { name: 'Jaina' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'Thrall' }));
    await user.click(within(zone).getByRole('button', { name: 'Transfer leadership' }));
    const dialog = await screen.findByRole('dialog', { name: 'Make Thrall the Guild Master?' });
    await user.click(within(dialog).getByRole('button', { name: 'Transfer leadership' }));

    await waitFor(() =>
      expect(bodyOf(fetchMock, 'transfer')).toEqual({ memberId: candidates[0]!.memberId }),
    );
  });

  it('disbands only once the guild name is typed', async () => {
    const fetchMock = api();
    const user = userEvent.setup();
    renderRoute(settingsPath);

    const zone = await screen.findByRole('region', { name: 'Danger zone' });
    await user.click(within(zone).getByRole('button', { name: 'Disband guild' }));
    const dialog = await screen.findByRole('dialog', { name: `Disband ${testGuild.name}?` });
    const confirm = within(dialog).getByRole('button', { name: 'Disband guild' });
    expect(confirm).toBeDisabled();
    await user.type(
      within(dialog).getByLabelText(`Type ${testGuild.name} to confirm`),
      testGuild.name,
    );
    await user.click(confirm);

    await waitFor(() => expect(bodyOf(fetchMock, 'disband')).toEqual({ name: testGuild.name }));
  });

  it("isn't shown to Officers", async () => {
    mockApi({
      [`/api/guilds/${ashenId}`]: () => Response.json({ ...testGuild, access: 'officer' }),
    });
    renderRoute(settingsPath);

    await screen.findByLabelText('Guild name');
    expect(screen.queryByRole('region', { name: 'Danger zone' })).not.toBeInTheDocument();
  });
});
