import type { SeriesResponse } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi } from '../../../test/api';
import { renderRoute } from '../../../test/render';

const seriesId = '019a0c3e-5b1e-7c2a-9f3d-000000000601';
const api = `/api/guilds/${ashenId}/series/${seriesId}`;
const nextYear = new Date().getUTCFullYear() + 1;

const series: SeriesResponse = {
  id: seriesId,
  type: 'raid',
  name: 'Molten Core',
  description: '',
  startsAt: `${nextYear}-11-10T19:00:00.000Z`,
  size: 40,
  slots: { tank: 4, healer: 10, dps: 26 },
  nextEventAt: `${nextYear}-11-10T19:00:00.000Z`,
  nextEventId: '019a0c3e-5b1e-7c2a-9f3d-000000000501',
  createdBy: 'Thrall',
  tentativeDeadlineHours: null,
  stopped: null,
};

describe('SeriesPage', () => {
  it('shows when the series repeats and stops it after asking', async () => {
    mockApi({
      [api]: () => Response.json(series),
      [`POST ${api}/stop`]: () =>
        Response.json({
          ...series,
          nextEventAt: null,
          nextEventId: null,
          stopped: { at: `${nextYear}-11-01T10:00:00.000Z`, by: 'Thrall' },
        }),
    });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/series/${seriesId}`);

    expect(await screen.findByRole('heading', { name: 'Molten Core' })).toBeInTheDocument();
    expect(screen.getByText(/^Every \w+ at 7:00 PM$/)).toBeInTheDocument();
    expect(screen.getByText(/^Next: \w+, November 10 · 7:00 PM$/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Tanks' })).getAllByText('Open slot'),
    ).toHaveLength(4);
    expect(screen.getAllByText('No one on the waitlist')).toHaveLength(40);
    expect(screen.getByRole('link', { name: 'Open the next event' })).toHaveAttribute(
      'href',
      `/guilds/${ashenId}/events/019a0c3e-5b1e-7c2a-9f3d-000000000501`,
    );
    expect(screen.getByRole('link', { name: 'Edit series' })).toHaveAttribute(
      'href',
      `/guilds/${ashenId}/events/series/${seriesId}/edit`,
    );

    await user.click(screen.getByRole('button', { name: 'Stop series' }));
    const dialog = await screen.findByRole('dialog', { name: 'Stop the series Molten Core?' });
    await user.click(within(dialog).getByRole('button', { name: 'Stop series' }));

    expect(await screen.findByText(/Stopped on .* by Thrall\./)).toBeInTheDocument();
    expect(screen.getByText('No upcoming events.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit series' })).not.toBeInTheDocument();
  });
});
