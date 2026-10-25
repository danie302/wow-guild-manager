import type { AttendanceReportResponse, AttendanceReportRow } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi } from '../../../test/api';
import { renderRoute } from '../../../test/render';

const row = (
  name: string,
  rate: number | null,
  band: AttendanceReportRow['band'],
): AttendanceReportRow => ({
  memberId: `m-${name}`,
  discordName: `${name}#discord`,
  rank: 'raider',
  main: { name, class: 'warrior' },
  attended: rate === null ? 0 : Math.round(rate * 10),
  total: rate === null ? 0 : 10,
  rate,
  late: 1,
  bench: 0,
  noShow: 0,
  band,
});

const report = (type: string): AttendanceReportResponse => ({
  period: '8',
  type: type as AttendanceReportResponse['type'],
  thresholds: { good: 90, atRisk: 75 },
  average: 0.8,
  bands: { good: 1, watch: 1, at_risk: 1 },
  members:
    type === 'raid'
      ? [row('Thrall', 1, 'good')]
      : [
          row('Thrall', 1, 'good'),
          row('Jaina', 0.6, 'at_risk'),
          row('Rexxar', 0.8, 'watch'),
          row('Newbie', null, null),
        ],
});

describe('AttendanceReportPage', () => {
  it('shows the bands and lists members, lowest rate first', async () => {
    mockApi({
      [`/api/guilds/${ashenId}/attendance`]: (init) => Response.json(report(init ? 'all' : 'all')),
    });
    renderRoute(`/guilds/${ashenId}/attendance`);

    expect(await screen.findByText('Guild average')).toBeInTheDocument();
    expect(screen.getAllByText('80%')).toHaveLength(2);
    expect(screen.getByText('At risk · below 75%')).toBeInTheDocument();
    const rows = within(screen.getByRole('list', { name: 'Attendance report' })).getAllByRole(
      'listitem',
    );
    // Each row starts with the main's name.
    const names = ['Jaina', 'Rexxar', 'Thrall', 'Newbie'];
    expect(rows.map((item) => names.find((name) => item.textContent?.startsWith(name)))).toEqual([
      'Jaina',
      'Rexxar',
      'Thrall',
      'Newbie',
    ]);
  });

  it('filters by event type and sorts by name', async () => {
    const fetchMock = mockApi({
      [`/api/guilds/${ashenId}/attendance`]: () => Response.json(report('all')),
    });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/attendance`);
    await screen.findByText('Guild average');

    await user.click(screen.getByRole('button', { name: 'Raid' }));
    await user.click(screen.getByRole('button', { name: 'All time' }));

    const urls = fetchMock.mock.calls.map(([url]) => (typeof url === 'string' ? url : ''));
    expect(urls).toContain(`/api/guilds/${ashenId}/attendance?period=8&type=raid`);
    expect(urls).toContain(`/api/guilds/${ashenId}/attendance?period=all&type=raid`);
  });

  it('sorts by clicking a heading, and the other way on a second click', async () => {
    mockApi({
      [`/api/guilds/${ashenId}/attendance`]: () => Response.json(report('all')),
    });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/attendance`);
    await screen.findByText('Guild average');
    const order = () =>
      within(screen.getByRole('list', { name: 'Attendance report' }))
        .getAllByRole('listitem')
        .map((item) =>
          ['Jaina', 'Rexxar', 'Thrall', 'Newbie'].find((n) => item.textContent?.startsWith(n)),
        );

    await user.click(screen.getByRole('button', { name: 'Attendance rate ↑' }));
    expect(order()).toEqual(['Thrall', 'Rexxar', 'Jaina', 'Newbie']);

    await user.click(screen.getByRole('button', { name: 'Member' }));
    expect(order()).toEqual(['Jaina', 'Newbie', 'Rexxar', 'Thrall']);
  });
});
