import type { EventResponse } from '@wgm/shared';
import { screen } from '@testing-library/react';
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
};

const me = { ...testUser, timeZone: 'America/Argentina/Buenos_Aires' };
const bodyOf = (fetchMock: ReturnType<typeof mockApi>, method: string) =>
  JSON.parse(
    fetchMock.mock.calls.find(([, init]) => init?.method === method)![1]!.body as string,
  ) as unknown;

describe('EventFormPage', () => {
  it("creates a raid, in the user's time zone, and opens it", async () => {
    const fetchMock = mockApi({
      '/api/me': () => Response.json(me),
      [`POST ${api}`]: () => Response.json(saved, { status: 201 }),
      [`${api}/${eventId}`]: () => Response.json(saved),
    });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/new`);

    await user.type(await screen.findByLabelText('Name'), 'Molten Core');
    await user.type(screen.getByLabelText('Description'), 'Fire resistance gear.');
    await user.type(screen.getByLabelText('Date'), `${nextYear}-11-10`);
    await user.type(screen.getByLabelText('Time'), '16:00');
    expect(screen.getByText('Total: 40 / 40')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create event' }));

    expect(await screen.findByRole('heading', { name: 'Molten Core' })).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST')).toEqual({
      type: 'raid',
      name: 'Molten Core',
      description: 'Fire resistance gear.',
      startsAt: `${nextYear}-11-10T19:00:00.000Z`,
      size: 40,
      slots: { tank: 4, healer: 10, dps: 26 },
    });
  });

  it('keeps the running total and refuses slots that do not add up', async () => {
    const fetchMock = mockApi({ '/api/me': () => Response.json(me) });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/new`);

    await user.click(await screen.findByRole('radio', { name: '20 players' }));
    expect(screen.getByText('Total: 20 / 20')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More: Tank' }));

    expect(screen.getByText('Total: 21 / 20')).toBeInTheDocument();
    expect(
      screen.getByText('The slots of the three combat roles must add up to the size.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create event' }));
    expect(screen.getByText('Required.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('fixes the slots of a dungeon', async () => {
    mockApi({ '/api/me': () => Response.json(me) });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/new`);

    await user.click(await screen.findByRole('radio', { name: 'Dungeon' }));

    expect(screen.getByText('Total: 5 / 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Tank')).toBeDisabled();
    expect(screen.getByLabelText('DPS')).toHaveValue('3');
  });

  it('edits an event without its type', async () => {
    const fetchMock = mockApi({
      '/api/me': () => Response.json(me),
      [`${api}/${eventId}`]: () => Response.json(saved),
      [`PUT ${api}/${eventId}`]: () => Response.json({ ...saved, name: 'Onyxia' }),
    });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/${eventId}/edit`);

    const name = await screen.findByLabelText('Name');
    expect(screen.getByLabelText('Time')).toHaveValue('16:00');
    expect(screen.queryByRole('radio', { name: 'Dungeon' })).not.toBeInTheDocument();
    await user.clear(name);
    await user.type(name, 'Onyxia');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'Onyxia' })).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'PUT')).toEqual({
      name: 'Onyxia',
      description: 'Fire resistance gear.',
      startsAt: saved.startsAt,
      size: 40,
      slots: { tank: 4, healer: 10, dps: 26 },
    });
  });
});
