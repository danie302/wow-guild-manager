import type { MeResponse, MemberDetailResponse } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ashenId, mockApi, testGuild, testUser } from '../../../test/api';
import { renderRoute } from '../../../test/render';

const memberId = '019a0c3e-5b1e-7c2a-9f3d-000000000100';
const memberPath = `/guilds/${ashenId}/roster/${memberId}`;
const memberApi = `/api/guilds/${ashenId}/members/${memberId}`;

const jainaCharacterId = '019a0c3e-5b1e-7c2a-9f3d-000000000201';
const proudmooreId = '019a0c3e-5b1e-7c2a-9f3d-000000000202';

const jaina: MemberDetailResponse = {
  id: memberId,
  discordUserId: '200000000000000004',
  discordName: 'Jaina',
  avatarUrl: '',
  rank: 'raider',
  baseRank: 'raider',
  characters: [
    {
      id: '019a0c3e-5b1e-7c2a-9f3d-000000000201',
      name: 'Jaina',
      faction: 'alliance',
      race: 'human',
      class: 'mage',
      level: 60,
      professions: ['tailoring', 'enchanting'],
      isMain: true,
    },
    {
      id: '019a0c3e-5b1e-7c2a-9f3d-000000000202',
      name: 'Proudmoore',
      faction: 'alliance',
      race: 'human',
      class: 'priest',
      level: 42,
      professions: [],
      isMain: false,
    },
  ],
  rankHistory: [
    {
      id: '019a0c3e-5b1e-7c2a-9f3d-000000000301',
      fromRank: 'raider',
      toRank: 'officer',
      source: 'discord',
      changedBy: null,
      at: '2026-10-01T18:00:00.000Z',
    },
    {
      id: '019a0c3e-5b1e-7c2a-9f3d-000000000302',
      fromRank: null,
      toRank: 'raider',
      source: 'app',
      changedBy: 'Anduin',
      at: '2026-09-01T18:00:00.000Z',
    },
  ],
  officerNotes: [
    {
      id: '019a0c3e-5b1e-7c2a-9f3d-000000000401',
      text: 'Trial until June.',
      author: 'Anduin',
      at: '2026-09-02T18:00:00.000Z',
    },
  ],
};

/** A fake API that keeps the member and applies each change to it. */
function mockMemberApi(start: MemberDetailResponse = jaina, me?: MeResponse) {
  let member = start;
  const body = (init?: RequestInit) => JSON.parse(init?.body as string) as Record<string, string>;
  return mockApi({
    ...(me && { '/api/me': () => Response.json(me) }),
    ...(me && {
      [`/api/guilds/${ashenId}`]: () => Response.json({ ...testGuild, access: 'officer' }),
    }),
    [memberApi]: () => Response.json(member),
    [`PATCH ${memberApi}`]: (init) => {
      const rank = body(init).rank as 'raider' | 'member';
      member = { ...member, rank, baseRank: rank };
      return Response.json(member);
    },
    [`PUT ${memberApi}/main`]: (init) => {
      const { characterId } = body(init);
      member = {
        ...member,
        characters: member.characters.map((c) => ({ ...c, isMain: c.id === characterId })),
      };
      return Response.json(member);
    },
    [`POST ${memberApi}/notes`]: (init) => {
      const note = {
        id: '019a0c3e-5b1e-7c2a-9f3d-000000000402',
        text: body(init).text!,
        author: 'Thrall',
        at: '2026-10-10T18:00:00.000Z',
      };
      member = { ...member, officerNotes: [note, ...member.officerNotes] };
      return Response.json(member);
    },
    [`PUT ${memberApi}/characters/${proudmooreId}`]: (init) => {
      const { class: characterClass, ...details } = body(init);
      member = {
        ...member,
        characters: member.characters.map((c) =>
          c.id === proudmooreId ? ({ ...c, ...details, class: characterClass } as typeof c) : c,
        ),
      };
      return Response.json(member);
    },
    [`DELETE ${memberApi}/characters/${jainaCharacterId}`]: () => {
      const rest = member.characters.filter((c) => c.id !== jainaCharacterId);
      member = { ...member, characters: rest.map((c, i) => ({ ...c, isMain: i === 0 })) };
      return Response.json(member);
    },
    [`DELETE ${memberApi}`]: () => new Response(null, { status: 204 }),
    [`/api/guilds/${ashenId}/members`]: () => Response.json([]),
  });
}

describe('MemberPage', () => {
  it('shows the characters, rank history, and officer notes', async () => {
    mockMemberApi();

    renderRoute(memberPath);

    expect(await screen.findByRole('heading', { name: 'Jaina' })).toBeInTheDocument();
    expect(screen.getByText('Human Mage · 60 · Tailoring, Enchanting')).toBeInTheDocument();
    expect(screen.getByText('Raider → Officer')).toBeInTheDocument();
    expect(screen.getByText(/Discord role$/)).toBeInTheDocument();
    expect(screen.getByText('Joined the roster as Raider')).toBeInTheDocument();
    expect(screen.getByText('Trial until June.')).toBeInTheDocument();
  });

  it('changes the rank, the main character, and adds a note', async () => {
    const fetchMock = mockMemberApi();
    const user = userEvent.setup();
    renderRoute(memberPath);

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Rank' }), 'Member');
    await user.click(screen.getByRole('button', { name: 'Make main' }));
    await user.type(screen.getByRole('textbox', { name: 'Add note' }), 'Passed the trial.');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    expect(await screen.findByText('Passed the trial.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Add note' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Rank' })).toHaveValue('member');
    const sent = fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET');
    expect(sent.map(([url, init]) => `${init!.method} ${url as string}`)).toEqual([
      `PATCH ${memberApi}`,
      `PUT ${memberApi}/main`,
      `POST ${memberApi}/notes`,
    ]);
  });

  it('edits a character with the same form as adding one', async () => {
    const fetchMock = mockMemberApi();
    const user = userEvent.setup();
    renderRoute(memberPath);

    // The alt's row: Proudmoore is the second character.
    await screen.findByText('Proudmoore');
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[1]!);
    const dialog = await screen.findByRole('dialog', { name: 'Edit Proudmoore' });
    expect(within(dialog).getByLabelText('Character name')).toHaveValue('Proudmoore');
    await user.clear(within(dialog).getByLabelText('Level'));
    await user.type(within(dialog).getByLabelText('Level'), '50');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Human Priest · 50/)).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.find(
      ([url, request]) =>
        url === `${memberApi}/characters/${proudmooreId}` && request?.method === 'PUT',
    )!;
    expect(JSON.parse(init!.body as string)).toEqual({
      name: 'Proudmoore',
      faction: 'alliance',
      race: 'human',
      class: 'priest',
      level: 50,
      professions: [],
    });
  });

  it('removes a character after asking, saying when it is the main', async () => {
    mockMemberApi();
    const user = userEvent.setup();
    renderRoute(memberPath);

    await screen.findByText('Proudmoore');
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Remove the character Jaina?' });
    expect(dialog).toHaveTextContent("It's the main");
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
  });

  it('removes the member after asking, and goes back to the roster', async () => {
    mockMemberApi();
    const user = userEvent.setup();
    renderRoute(memberPath);

    await user.click(await screen.findByRole('button', { name: 'Remove from roster' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove Jaina from the roster?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove from roster' }));

    expect(await screen.findByRole('heading', { name: 'Roster' })).toBeInTheDocument();
  });

  it("doesn't let an Officer change the rank of, or remove, another Officer", async () => {
    const officerMe: MeResponse = {
      ...testUser,
      guilds: [{ id: ashenId, name: 'Ashen Vanguard', imageUrl: null, access: 'officer' }],
    };
    mockMemberApi({ ...jaina, rank: 'officer' }, officerMe);

    renderRoute(memberPath);

    expect(
      await screen.findByText('Only the Guild Master can change the rank of an Officer.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Rank' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove from roster' })).toBeDisabled();
    expect(screen.getByText('Only the Guild Master can remove an Officer.')).toBeInTheDocument();
  });

  it("explains that the Guild Master can't be removed", async () => {
    mockMemberApi({ ...jaina, rank: 'guild_master' });

    renderRoute(memberPath);

    expect(await screen.findByRole('button', { name: 'Remove from roster' })).toBeDisabled();
    expect(
      screen.getByText("The Guild Master can't be removed. Transfer leadership first."),
    ).toBeInTheDocument();
  });
});
