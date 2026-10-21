import type { PendingRegistration } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi } from '../../../test/api';
import { renderRoute } from '../../../test/render';

const path = `/guilds/${ashenId}/registrations`;
const api = `/api/guilds/${ashenId}/registrations`;
const memberId = '019a0c3e-5b1e-7c2a-9f3d-000000000201';

const tyra: PendingRegistration = {
  id: '019a0c3e-5b1e-7c2a-9f3d-000000000101',
  discordUserId: '200000000000000005',
  discordName: 'Tyra',
  avatarUrl: '',
  onRoster: false,
  returning: false,
  requestedAt: '2026-10-20T18:30:00.000Z',
  leftDiscordAt: null,
};
const furion: PendingRegistration = {
  ...tyra,
  id: '019a0c3e-5b1e-7c2a-9f3d-000000000102',
  discordUserId: '200000000000000006',
  discordName: 'Furion',
  returning: true,
};

function items() {
  return within(screen.getByRole('list', { name: 'Requests to join' })).getAllByRole('listitem');
}

describe('RegistrationsPage', () => {
  it('lists the requests, marking who is coming back', async () => {
    mockApi({ [api]: () => Response.json([tyra, furion]) });

    renderRoute(path);

    expect(await screen.findByText('Tyra')).toBeInTheDocument();
    const [first, second] = items();
    expect(first).toHaveTextContent('/register · Oct 20, 2026, 6:30 PM');
    expect(first).not.toHaveTextContent('Was on the roster');
    expect(second).toHaveTextContent('Was on the roster: comes back with their characters');
  });

  it('says when nothing is waiting', async () => {
    mockApi({ [api]: () => Response.json([]) });

    renderRoute(path);

    expect(await screen.findByText('No requests waiting.')).toBeInTheDocument();
  });

  it('approves a request and links to the new member to add their characters', async () => {
    let pending = [tyra];
    mockApi({
      [api]: () => Response.json(pending),
      [`POST ${api}/${tyra.id}/approve`]: () => {
        pending = [];
        return Response.json({ memberId, restored: false });
      },
    });
    const user = userEvent.setup();
    renderRoute(path);

    await user.click(await screen.findByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Tyra joined the roster.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add characters' })).toHaveAttribute(
      'href',
      `/guilds/${ashenId}/roster/${memberId}`,
    );
    expect(await screen.findByText('No requests waiting.')).toBeInTheDocument();
  });

  it('says when a returning member gets their characters back', async () => {
    mockApi({
      [api]: () => Response.json([furion]),
      [`POST ${api}/${furion.id}/approve`]: () => Response.json({ memberId, restored: true }),
    });
    const user = userEvent.setup();
    renderRoute(path);

    await user.click(await screen.findByRole('button', { name: 'Approve' }));

    expect(
      await screen.findByText('Furion is back on the roster, with their characters.'),
    ).toBeInTheDocument();
  });

  it('shows why a review failed', async () => {
    mockApi({
      [api]: () => Response.json([tyra]),
      [`POST ${api}/${tyra.id}/approve`]: () =>
        Response.json({ error: { code: 'REGISTRATION_NOT_PENDING' } }, { status: 409 }),
    });
    const user = userEvent.setup();
    renderRoute(path);

    await user.click(await screen.findByRole('button', { name: 'Approve' }));

    expect(
      await screen.findByText('This request was already approved or rejected.'),
    ).toBeInTheDocument();
  });

  it('rejects a request after confirming', async () => {
    let pending = [tyra];
    mockApi({
      [api]: () => Response.json(pending),
      [`POST ${api}/${tyra.id}/reject`]: () => {
        pending = [];
        return new Response(null, { status: 204 });
      },
    });
    const user = userEvent.setup();
    renderRoute(path);

    await user.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', { name: "Reject Tyra's request?" });
    expect(dialog).toHaveTextContent('Tyra gets a direct message');
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText("Tyra's request was rejected.")).toBeInTheDocument();
    expect(await screen.findByText('No requests waiting.')).toBeInTheDocument();
  });

  it('marks a request from someone who left the Discord server', async () => {
    mockApi({
      [api]: () => Response.json([{ ...tyra, leftDiscordAt: '2026-10-21T08:00:00.000Z' }]),
    });

    renderRoute(path);

    expect(await screen.findByText('Left the Discord server')).toBeInTheDocument();
  });
});
