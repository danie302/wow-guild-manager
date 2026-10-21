import type { AddMemberResponse, RosterMember } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi, testUser } from '../../../test/api';
import { renderRoute } from '../../../test/render';
import { choose } from '../../../test/select';

const rosterPath = `/guilds/${ashenId}/roster`;

let nextId = 0;
/** A distinct UUID for each test record. */
const uuid = () => `019a0c3e-5b1e-7c2a-9f3d-${String(++nextId).padStart(12, '0')}`;
const members = `/api/guilds/${ashenId}/members`;

function rosterMember(
  name: string,
  rank: RosterMember['rank'],
  characters: RosterMember['characters'],
) {
  return {
    id: uuid(),
    discordUserId: '200000000000000001',
    discordName: name,
    avatarUrl: '',
    rank,
    baseRank: 'raider',
    characters,
    leftDiscordAt: null,
  } satisfies RosterMember;
}

const character = (
  name: string,
  cls: RosterMember['characters'][number]['class'],
  isMain: boolean,
) => ({
  id: uuid(),
  name,
  faction: 'alliance' as const,
  race: 'human' as const,
  class: cls,
  level: 60,
  professions: ['tailoring' as const],
  isMain,
});

const roster = [
  rosterMember('Anduin', 'guild_master', [character('Anduin', 'priest', true)]),
  rosterMember('Jaina', 'officer', [
    character('Jaina', 'mage', true),
    character('Jainalt', 'warlock', false),
  ]),
  rosterMember('Varian', 'raider', [character('Varian', 'warrior', true)]),
];

function rows() {
  return within(screen.getByRole('list', { name: 'Roster' })).getAllByRole('listitem');
}

describe('RosterPage', () => {
  it('lists members with their rank, main, alt count, and professions', async () => {
    mockApi({ [members]: () => Response.json(roster) });

    renderRoute(rosterPath);

    expect(await screen.findByText('3 members')).toBeInTheDocument();
    const jaina = rows()[1]!;
    expect(jaina).toHaveTextContent('Jaina');
    expect(jaina).toHaveTextContent('Officer');
    expect(jaina).toHaveTextContent('+1 alt');
    expect(jaina).toHaveTextContent('Mage · Human · 60');
    expect(screen.queryByText('No members match.')).not.toBeInTheDocument();
    expect(jaina).toHaveTextContent('Tailoring');
    expect(jaina).toHaveAttribute('href', `${rosterPath}/${roster[1]!.id}`);
  });

  it('searches by Discord or character name, and filters by rank and class', async () => {
    mockApi({ [members]: () => Response.json(roster) });
    const user = userEvent.setup();
    renderRoute(rosterPath);

    await user.type(
      await screen.findByRole('searchbox', { name: 'Search Discord or character' }),
      'jainalt',
    );
    expect(rows()).toHaveLength(1);
    await user.clear(screen.getByRole('searchbox'));

    await user.click(screen.getByRole('button', { name: 'Raider' }));
    expect(rows().map((row) => row.textContent)).toEqual([expect.stringContaining('Varian')]);
    await user.click(screen.getByRole('button', { name: 'All' }));

    await user.click(screen.getByRole('button', { name: 'Warlock' }));
    expect(rows().map((row) => row.textContent)).toEqual([expect.stringContaining('Jaina')]);
  });

  it('adds a member picked from the Discord server, with a character', async () => {
    const added: AddMemberResponse = {
      member: {
        ...roster[2]!,
        discordName: 'Tyrande',
        rankHistory: [],
        officerNotes: [],
      },
      restored: false,
      unrestoredCharacters: [],
    };
    const fetchMock = mockApi({
      [members]: () => Response.json(roster),
      [`POST ${members}`]: () => Response.json(added, { status: 201 }),
      [`/api/guilds/${ashenId}/discord-members`]: () =>
        Response.json([
          { id: '200000000000000005', name: 'Tyrande', avatarUrl: '', onRoster: false },
          { id: '200000000000000006', name: 'Tyrion', avatarUrl: '', onRoster: true },
        ]),
    });
    const user = userEvent.setup();
    renderRoute(rosterPath);

    await user.click(await screen.findByRole('button', { name: 'Add member' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add member' });
    await user.type(within(dialog).getByRole('combobox', { name: 'Discord user' }), 'ty');
    expect(
      await screen.findByRole('option', { name: /Tyrion.*Already on the roster/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Tyrande/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Member' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add character' }));
    await user.type(within(dialog).getByLabelText('Character name'), 'Tyrande');
    // Only Alliance races, and classes of the chosen race.
    await user.click(within(dialog).getByRole('combobox', { name: 'Race' }));
    const races = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(races.map((race) => race.textContent)).toEqual([
      'Human',
      'Dwarf',
      'Night Elf',
      'Gnome',
      'Skyborne',
    ]);
    await user.click(screen.getByRole('option', { name: 'Night Elf' }));
    await user.click(within(dialog).getByRole('combobox', { name: 'Class' }));
    const classes = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(classes.map((option) => option.textContent)).toEqual([
      'Warrior',
      'Hunter',
      'Rogue',
      'Priest',
      'Druid',
    ]);
    await user.click(screen.getByRole('option', { name: 'Priest' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'First Aid' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add to roster' }));

    expect(await screen.findByText('Tyrande added to the roster.')).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.find(
      ([url, request]) => url === members && request?.method === 'POST',
    )!;
    expect(JSON.parse(init!.body as string)).toEqual({
      discordUserId: '200000000000000005',
      rank: 'member',
      characters: [
        {
          name: 'Tyrande',
          faction: 'alliance',
          race: 'night_elf',
          class: 'priest',
          level: 60,
          professions: ['first_aid'],
        },
      ],
    });
  });

  it('adds a member without characters', async () => {
    const fetchMock = mockApi({
      [members]: () => Response.json(roster),
      [`POST ${members}`]: () =>
        Response.json(
          {
            member: {
              ...roster[2]!,
              discordName: 'Tyrande',
              characters: [],
              rankHistory: [],
              officerNotes: [],
            },
            restored: false,
            unrestoredCharacters: [],
          } satisfies AddMemberResponse,
          { status: 201 },
        ),
      [`/api/guilds/${ashenId}/discord-members`]: () =>
        Response.json([
          { id: '200000000000000005', name: 'Tyrande', avatarUrl: '', onRoster: false },
        ]),
    });
    const user = userEvent.setup();
    renderRoute(rosterPath);
    await user.click(await screen.findByRole('button', { name: 'Add member' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add member' });

    expect(within(dialog).getByText(/No characters yet/)).toBeInTheDocument();
    await user.type(within(dialog).getByRole('combobox', { name: 'Discord user' }), 'ty');
    await user.click(await screen.findByRole('option', { name: /Tyrande/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add to roster' }));

    expect(await screen.findByText('Tyrande added to the roster.')).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.find(
      ([url, request]) => url === members && request?.method === 'POST',
    )!;
    expect(JSON.parse(init!.body as string)).toMatchObject({ characters: [] });
  });

  it("shows what's wrong with a character before sending it, and the server's answer", async () => {
    const fetchMock = mockApi({
      [members]: () => Response.json(roster),
      [`POST ${members}`]: () =>
        Response.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              issues: [{ field: 'characters.0.name', code: 'CHARACTER_NAME_TAKEN' }],
            },
          },
          { status: 400 },
        ),
      [`/api/guilds/${ashenId}/discord-members`]: () =>
        Response.json([
          { id: '200000000000000005', name: 'Tyrande', avatarUrl: '', onRoster: false },
        ]),
    });
    const user = userEvent.setup();
    renderRoute(rosterPath);
    await user.click(await screen.findByRole('button', { name: 'Add member' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add member' });

    await user.click(within(dialog).getByRole('button', { name: 'Add to roster' }));
    expect(within(dialog).getByText('Choose a Discord user.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, request]) => request?.method === 'POST')).toBe(false);

    await user.type(within(dialog).getByRole('combobox', { name: 'Discord user' }), 'ty');
    await user.click(await screen.findByRole('option', { name: /Tyrande/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Add character' }));
    await user.type(within(dialog).getByLabelText('Character name'), 'Thrall');
    await choose(user, within(dialog).getByRole('combobox', { name: 'Race' }), 'Human');
    await choose(user, within(dialog).getByRole('combobox', { name: 'Class' }), 'Mage');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Tailoring' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add to roster' }));

    expect(
      await within(dialog).findByText('Another character already has this name.'),
    ).toBeInTheDocument();
  });

  it('flags members who left the Discord server, and can show only them', async () => {
    const left = { ...roster[2]!, leftDiscordAt: '2026-10-19T12:00:00.000Z' };
    mockApi({ [members]: () => Response.json([roster[0], roster[1], left]) });
    const user = userEvent.setup();
    renderRoute(rosterPath);

    expect(await screen.findByText('Left Discord Oct 19, 2026')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Left Discord only' }));

    expect(rows().map((row) => row.textContent)).toEqual([expect.stringContaining('Varian')]);
  });

  it('marks the logged-in user, and says when no member matches the filters', async () => {
    const me = { ...roster[0]!, discordUserId: testUser.discordId };
    mockApi({ [members]: () => Response.json([me, roster[1]]) });
    const user = userEvent.setup();
    renderRoute(rosterPath);

    await screen.findByRole('list', { name: 'Roster' });
    expect(within(rows()[0]!).getByText('You')).toBeInTheDocument();
    expect(within(rows()[1]!).queryByText('You')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Druid' }));

    expect(screen.getByText('No members match.')).toBeInTheDocument();
  });
});
