import type { AttendanceResponse, EventResponse } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi } from '../../../test/api';
import { renderRoute } from '../../../test/render';

const api = `/api/guilds/${ashenId}/events`;
const eventId = '019a0c3e-5b1e-7c2a-9f3d-000000000501';

const started: EventResponse = {
  id: eventId,
  type: 'raid',
  name: 'Molten Core',
  description: '',
  startsAt: '2026-01-10T19:00:00.000Z',
  size: 40,
  slots: { tank: 4, healer: 10, dps: 26 },
  filled: { tank: 0, healer: 0, dps: 0 },
  createdBy: 'Thrall',
  cancelled: null,
  series: null,
  tentativeDeadline: { at: '2026-01-09T19:00:00.000Z', hours: 24, own: false },
  discordPost: { url: null, error: null },
};

const record = (memberId: string, name: string, status: 'present' | 'bench') => ({
  memberId,
  discordName: `${name} on Discord`,
  character: { id: `${memberId}-char`, name, class: 'warrior' as const, race: 'orc' as const },
  role: 'tank' as const,
  signedUp: true,
  status,
});

const draft: AttendanceResponse = {
  open: true,
  recorded: null,
  records: [record('m1', 'Thrall', 'present'), record('m2', 'Rexxar', 'bench')],
  history: [],
};

async function openTab() {
  const user = userEvent.setup();
  renderRoute(`/guilds/${ashenId}/events/${eventId}`);
  await user.click(await screen.findByRole('tab', { name: 'Attendance' }));
  return user;
}

describe('AttendanceTab', () => {
  it('starts from the sign-ups, and saves the whole list', async () => {
    const fetchMock = mockApi({
      [`${api}/${eventId}`]: () => Response.json(started),
      [`${api}/${eventId}/attendance`]: () => Response.json(draft),
      [`PUT ${api}/${eventId}/attendance`]: () =>
        Response.json({ ...draft, recorded: { at: '2026-01-10T23:00:00.000Z', by: 'Thrall' } }),
    });
    const user = await openTab();

    expect(await screen.findByText('Not saved yet')).toBeInTheDocument();
    const rexxar = screen.getByRole('group', { name: 'Attendance of Rexxar' });
    expect(within(rexxar).getByRole('button', { name: 'Bench' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(rexxar).getByRole('button', { name: 'Late' }));
    await user.click(screen.getByRole('button', { name: 'Save attendance' }));

    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(put![1]!.body as string)).toEqual({
      records: [
        { memberId: 'm1', status: 'present' },
        { memberId: 'm2', status: 'late' },
      ],
    });
    expect(await screen.findByText(/Saved on .* by Thrall/)).toBeInTheDocument();
  });

  it('shows the corrections', async () => {
    mockApi({
      [`${api}/${eventId}`]: () => Response.json(started),
      [`${api}/${eventId}/attendance`]: () =>
        Response.json({
          ...draft,
          recorded: { at: '2026-01-10T23:00:00.000Z', by: 'Thrall' },
          history: [
            {
              id: 'c1',
              memberId: 'm2',
              character: { name: 'Rexxar', class: 'warrior' },
              from: 'bench',
              to: 'no_show',
              by: 'Jaina',
              at: '2026-01-11T10:00:00.000Z',
            },
          ],
        } satisfies AttendanceResponse),
    });
    await openTab();

    const history = await screen.findByRole('region', { name: 'Change history' });
    expect(within(history).getByText('Rexxar')).toBeInTheDocument();
    expect(within(history).getByText('No-show')).toBeInTheDocument();
    expect(within(history).getByText(/Jaina/)).toBeInTheDocument();
  });

  it('waits for the event to start', async () => {
    mockApi({
      [`${api}/${eventId}`]: () => Response.json(started),
      [`${api}/${eventId}/attendance`]: () =>
        Response.json({ open: false, recorded: null, records: [], history: [] }),
    });
    await openTab();

    expect(await screen.findByText('Attendance opens when the event starts.')).toBeInTheDocument();
  });
});
