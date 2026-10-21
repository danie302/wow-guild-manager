import type { EventResponse } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi, testUser } from '../../../test/api';
import { renderRoute } from '../../../test/render';

const path = `/guilds/${ashenId}/events`;
const api = `/api/guilds/${ashenId}/events`;

const mc: EventResponse = {
  id: '019a0c3e-5b1e-7c2a-9f3d-000000000501',
  type: 'raid',
  name: 'Molten Core',
  description: '',
  startsAt: '2026-11-10T19:00:00.000Z',
  size: 40,
  slots: { tank: 4, healer: 10, dps: 26 },
  createdBy: 'Anduin',
  cancelled: null,
};
const wsg: EventResponse = {
  ...mc,
  id: '019a0c3e-5b1e-7c2a-9f3d-000000000502',
  type: 'pvp',
  name: 'Warsong Gulch',
  startsAt: '2026-11-11T02:00:00.000Z',
  size: 10,
  slots: { tank: 0, healer: 2, dps: 8 },
  cancelled: { at: '2026-11-01T10:00:00.000Z', by: 'Anduin' },
};

/** The API, answering each list (upcoming, past, or a calendar range) with its events. */
function eventsApi(
  lists: { upcoming?: EventResponse[]; past?: EventResponse[]; range?: EventResponse[] },
  me = testUser,
) {
  const fetchMock = mockApi({ '/api/me': () => Response.json(me) });
  const handle = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((input, init) => {
    const href = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    const url = new URL(href, 'http://localhost');
    if (url.pathname !== api) return handle(input, init);
    const scope = url.searchParams.get('scope');
    const events =
      scope === 'upcoming' ? lists.upcoming : scope === 'past' ? lists.past : lists.range;
    return Promise.resolve(Response.json(events ?? []));
  });
  return fetchMock;
}

describe('EventsPage', () => {
  it('lists upcoming events with their time, type, size, and slots', async () => {
    eventsApi({ upcoming: [mc, wsg] });

    renderRoute(path);

    const list = await screen.findByRole('list', { name: 'Upcoming' });
    const [first, second] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent('Tue10Nov');
    expect(first).toHaveTextContent('Molten Core');
    expect(first).toHaveTextContent('7:00 PM · Raid · 40 players');
    expect(first).toHaveTextContent('4 Tank · 10 Healer · 26 DPS');
    expect(first).toHaveAttribute('href', `${path}/${mc.id}`);
    expect(second).toHaveTextContent('2 Healer · 8 DPS');
    expect(second).toHaveTextContent('Cancelled');
  });

  it('switches to past events', async () => {
    eventsApi({ upcoming: [mc], past: [] });
    const user = userEvent.setup();
    renderRoute(path);

    await screen.findByText('Molten Core');
    await user.click(screen.getByRole('radio', { name: 'Past' }));

    expect(await screen.findByText('No past events.')).toBeInTheDocument();
  });

  it("shows the calendar month with each event on its day in the user's time zone", async () => {
    eventsApi({ range: [mc, wsg] }, { ...testUser, timeZone: 'America/Argentina/Buenos_Aires' });
    const user = userEvent.setup();
    renderRoute(`${path}?view=calendar&month=2026-11`);

    const grid = await screen.findByRole('grid', { name: 'November 2026' });
    // 19:00 UTC is 16:00 in Buenos Aires, and 02:00 UTC on the 11th is still the 10th there.
    const tenth = within(grid)
      .getAllByRole('gridcell')
      .find((cell) => cell.textContent?.startsWith('10'))!;
    expect(await within(tenth).findByRole('link', { name: /Molten Core/ })).toHaveTextContent(
      '4:00 PM',
    );
    expect(within(tenth).getByRole('link', { name: /Warsong Gulch/ })).toHaveTextContent(
      '11:00 PM',
    );

    await user.click(screen.getByRole('button', { name: 'Next month' }));

    expect(await screen.findByRole('grid', { name: 'December 2026' })).toBeInTheDocument();
  });
});
