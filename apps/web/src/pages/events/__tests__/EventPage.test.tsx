import type { EventResponse } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi, testUser } from '../../../test/api';
import { renderRoute } from '../../../test/render';

const api = `/api/guilds/${ashenId}/events`;
const eventId = '019a0c3e-5b1e-7c2a-9f3d-000000000501';
const nextYear = new Date().getUTCFullYear() + 1;

const saved: EventResponse = {
  id: eventId,
  type: 'raid',
  name: 'Molten Core',
  description: 'Fire resistance gear.',
  startsAt: `${nextYear}-11-10T19:00:00.000Z`,
  size: 40,
  slots: { tank: 4, healer: 10, dps: 26 },
  createdBy: 'Thrall',
  cancelled: null,
  series: null,
};

const me = { ...testUser, timeZone: 'America/Argentina/Buenos_Aires' };

describe('EventPage', () => {
  it('shows the event and cancels it after asking', async () => {
    mockApi({
      '/api/me': () => Response.json(me),
      [`${api}/${eventId}`]: () => Response.json(saved),
      [`POST ${api}/${eventId}/cancel`]: () =>
        Response.json({
          ...saved,
          cancelled: { at: `${nextYear}-11-01T13:00:00.000Z`, by: 'Thrall' },
        }),
    });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/${eventId}`);

    expect(await screen.findByRole('heading', { name: 'Molten Core' })).toBeInTheDocument();
    expect(screen.getByText('Raid · 40 players')).toBeInTheDocument();
    expect(screen.getByText(/November 10, \d{4} at 4:00 PM/)).toBeInTheDocument();
    expect(screen.getByText('Fire resistance gear.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel event' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel Molten Core?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel event' }));

    expect(await screen.findByText(/Cancelled on Nov 1, \d{4}.* by Thrall/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it("can't change an event that started", async () => {
    mockApi({
      [`${api}/${eventId}`]: () =>
        Response.json({ ...saved, startsAt: '2020-01-01T19:00:00.000Z' }),
    });

    renderRoute(`/guilds/${ashenId}/events/${eventId}`);

    expect(
      await screen.findByText("This event has started, so it can't be edited or cancelled."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel event' })).not.toBeInTheDocument();
  });
});
