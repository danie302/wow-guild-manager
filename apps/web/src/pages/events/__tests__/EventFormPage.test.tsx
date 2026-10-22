import type { EventResponse, RosterMember, SignUpResponse } from '@wgm/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi, testGuild, testUser } from '../../../test/api';
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
  discordPost: { url: null, error: null },
  tentativeDeadline: { at: '2026-01-01T00:00:00.000Z', hours: 24, own: false },
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
    expect(screen.getByRole('group', { name: 'Total' })).toHaveTextContent('40 / 40');
    await user.click(screen.getByRole('button', { name: 'Create event' }));

    expect(await screen.findByRole('heading', { name: 'Molten Core' })).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST')).toEqual({
      type: 'raid',
      name: 'Molten Core',
      description: 'Fire resistance gear.',
      startsAt: `${nextYear}-11-10T19:00:00.000Z`,
      size: 40,
      slots: { tank: 4, healer: 10, dps: 26 },
      tentativeDeadlineHours: null,
    });
  });

  it('keeps the running total, and only saves once everything is right', async () => {
    mockApi({ '/api/me': () => Response.json(me) });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/new`);

    const create = await screen.findByRole('button', { name: 'Create event' });
    expect(create).toBeDisabled();
    expect(screen.getByText('Add a name to save.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Molten Core');
    await user.type(screen.getByLabelText('Date'), `${nextYear}-11-10`);
    await user.type(screen.getByLabelText('Time'), '16:00');
    await user.click(screen.getByRole('button', { name: '20' }));
    expect(screen.getByRole('group', { name: 'Total' })).toHaveTextContent('20 / 20');
    expect(create).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'More: Tank' }));

    expect(screen.getByRole('group', { name: 'Total' })).toHaveTextContent('21 / 20');
    expect(
      screen.getByText('The slots of the three combat roles must add up to the size.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Make the slots add up to the size to save.')).toBeInTheDocument();
    expect(create).toBeDisabled();
  });

  it('says when the date is in the past', async () => {
    mockApi({ '/api/me': () => Response.json(me) });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/new`);

    await user.type(await screen.findByLabelText('Name'), 'Molten Core');
    await user.type(screen.getByLabelText('Date'), '2020-11-10');
    await user.type(screen.getByLabelText('Time'), '16:00');

    expect(screen.getByText('Pick a date and time in the future.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create event' })).toBeDisabled();
  });

  it('fixes the slots of a dungeon', async () => {
    mockApi({ '/api/me': () => Response.json(me) });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/new`);

    await user.click(await screen.findByRole('button', { name: 'Dungeon' }));

    expect(screen.getByRole('group', { name: 'Total' })).toHaveTextContent('5 / 5');
    expect(screen.getByLabelText('Tanks')).toBeDisabled();
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
    expect(screen.queryByRole('button', { name: 'Dungeon' })).not.toBeInTheDocument();
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
      tentativeDeadlineHours: null,
    });
  });

  it('lets the Guild Master pre-confirm participants of a new raid', async () => {
    const raider = (name: string, rank: RosterMember['rank']): RosterMember => ({
      id: `019a0c3e-5b1e-7c2a-9f3d-00000000100${name.length}`,
      discordUserId: `2000000000000000${name.length}`,
      discordName: name,
      avatarUrl: '',
      rank,
      baseRank: 'raider',
      leftDiscordAt: null,
      characters: [
        {
          id: `019a0c3e-5b1e-7c2a-9f3d-00000000110${name.length}`,
          name: `${name}char`,
          faction: 'horde',
          race: 'orc',
          class: 'warrior',
          level: 60,
          professions: [],
          isMain: true,
        },
      ],
    });
    const fetchMock = mockApi({
      '/api/me': () => Response.json(me),
      [`/api/guilds/${ashenId}/members`]: () =>
        Response.json([raider('Saurfang', 'raider'), raider('Peon', 'member')]),
      [`POST ${api}`]: () => Response.json(saved, { status: 201 }),
      [`${api}/${eventId}`]: () => Response.json(saved),
    });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/new`);

    await user.type(await screen.findByLabelText('Name'), 'Molten Core');
    await user.type(screen.getByLabelText('Date'), `${nextYear}-11-10`);
    await user.type(screen.getByLabelText('Time'), '16:00');
    const member = screen.getByRole('combobox', { name: 'Member' });
    await waitFor(() => expect(member).toBeEnabled());
    await user.click(member);
    // Members can't join raids, so they aren't offered.
    expect(screen.queryByRole('option', { name: /Peon/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: /Saurfang/ }));
    await user.click(screen.getByRole('button', { name: 'Tank' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Create event' }));

    await screen.findByRole('heading', { name: 'Molten Core' });
    expect(bodyOf(fetchMock, 'POST')).toMatchObject({
      preConfirmed: [{ characterId: '019a0c3e-5b1e-7c2a-9f3d-000000001108', role: 'tank' }],
    });
  });

  it("doesn't offer pre-confirming to Officers, or for a dungeon", async () => {
    mockApi({
      '/api/me': () => Response.json(me),
      [`/api/guilds/${ashenId}`]: () => Response.json({ ...testGuild, access: 'officer' }),
    });
    renderRoute(`/guilds/${ashenId}/events/new`);

    await screen.findByLabelText('Name');
    expect(
      screen.queryByRole('region', { name: 'Pre-confirmed participants' }),
    ).not.toBeInTheDocument();
  });

  it("gives an event its own Tentative deadline, or the guild's", async () => {
    const fetchMock = mockApi({
      '/api/me': () => Response.json(me),
      [`${api}/${eventId}`]: () => Response.json(saved),
      [`PUT ${api}/${eventId}`]: () => Response.json(saved),
    });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/${eventId}/edit`);

    await screen.findByLabelText('Name');
    expect(screen.getByRole('button', { name: 'Guild default (24 h)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Custom' }));
    const hours = screen.getByLabelText('Hours before the start (1–168)');
    await user.clear(hours);
    await user.type(hours, '48');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('heading', { name: 'Molten Core' });
    expect(bodyOf(fetchMock, 'PUT')).toMatchObject({ tentativeDeadlineHours: 48 });
  });

  it('warns who moves to the waitlist when a role gets fewer slots', async () => {
    const tank = (name: string, minute: number): SignUpResponse => ({
      id: `019a0c3e-5b1e-7c2a-9f3d-0000000006${minute}`,
      character: {
        id: `019a0c3e-5b1e-7c2a-9f3d-0000000007${minute}`,
        name,
        class: 'warrior',
        race: 'orc',
      },
      role: 'tank',
      status: 'confirmed',
      placement: 'slot',
      signedUpAt: `${nextYear}-11-01T10:${minute}:00.000Z`,
    });
    mockApi({
      '/api/me': () => Response.json(me),
      [`${api}/${eventId}`]: () => Response.json(saved),
      [`${api}/${eventId}/sign-ups`]: () =>
        Response.json([
          tank('Saurfang', 10),
          tank('Grommash', 20),
          tank('Thrall', 30),
          tank('Rexxar', 40),
        ]),
    });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/${eventId}/edit`);
    await screen.findByLabelText('Name');

    await user.click(screen.getByRole('button', { name: 'Fewer: Tank' }));
    await user.click(screen.getByRole('button', { name: 'Fewer: Tank' }));

    expect(
      await screen.findByText(
        'Saving moves 2 participants to the front of the waitlist, and they get a direct message:',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Thrall (Tank), Rexxar (Tank)')).toBeInTheDocument();
  });

  it('creates a weekly series and opens it', async () => {
    const series = {
      ...saved,
      id: '019a0c3e-5b1e-7c2a-9f3d-000000000601',
      nextEventAt: saved.startsAt,
      nextEventId: null,
      stopped: null,
    };
    const fetchMock = mockApi({
      '/api/me': () => Response.json(me),
      [`POST /api/guilds/${ashenId}/series`]: () => Response.json(series, { status: 201 }),
      [`/api/guilds/${ashenId}/series/${series.id}`]: () => Response.json(series),
    });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/new`);

    await user.type(await screen.findByLabelText('Name'), 'Molten Core');
    await user.type(screen.getByLabelText('Date'), `${nextYear}-11-10`);
    await user.type(screen.getByLabelText('Time'), '16:00');
    await user.click(screen.getByRole('checkbox', { name: 'Repeat every week on this day' }));
    await user.click(screen.getByRole('button', { name: 'Create weekly series' }));

    expect(await screen.findByText(/^Every \w+ at 4:00 PM$/)).toBeInTheDocument();
    const [url] = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(url).toBe(`/api/guilds/${ashenId}/series`);
  });
});
