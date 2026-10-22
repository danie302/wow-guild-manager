import type {
  EventDiscordPostResponse,
  EventResponse,
  RosterMember,
  SignUpResponse,
} from '@wgm/shared';
import { screen, waitFor, within } from '@testing-library/react';
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
    expect(screen.getByText('Raid')).toBeInTheDocument();
    expect(screen.getByText('40 players')).toBeInTheDocument();
    expect(screen.getByText(/November 10 · 4:00 PM/)).toBeInTheDocument();
    const roles = within(screen.getByRole('list', { name: 'Slots' })).getAllByRole('listitem');
    expect(roles.map((role) => role.textContent)).toEqual([
      'Tanks0/4Missing 4',
      'Healers0/10Missing 10',
      'DPS0/26Missing 26',
    ]);
    expect(
      within(screen.getByRole('region', { name: 'Tanks' })).getAllByText('Open slot'),
    ).toHaveLength(4);
    expect(screen.getByText('Fire resistance gear.')).toBeInTheDocument();
    expect(screen.getByText(/Tentative closes .* · 24 h before the start/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel event' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel Molten Core?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel event' }));

    expect(
      await screen.findByText(/Cancelled on Nov 1, \d{4}.* by Thrall. Sign-ups are closed./),
    ).toBeInTheDocument();
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

  it('previews the Discord post in the user time zone, and links to it', async () => {
    const startsAt = Date.parse(saved.startsAt) / 1000;
    const preview: EventDiscordPostResponse = {
      channel: { id: '500000000000000001', name: 'raid-signups' },
      locale: 'es',
      embed: {
        title: '~~Molten Core~~',
        description: '**This event has been cancelled.**',
        color: 0x80848e,
        fields: [
          { name: 'Date', value: `<t:${startsAt}:F>` },
          {
            name: '\u200b',
            value: '__**Tank**__ (1/4)\n<:wgm_warrior:123> `1` **Grommash**',
            inline: true,
          },
        ],
      },
      buttons: [{ label: 'Inscribirse', style: 'primary' }],
    };
    mockApi({
      '/api/me': () => Response.json(me),
      [`${api}/${eventId}`]: () =>
        Response.json({
          ...saved,
          discordPost: { url: 'https://discord.com/channels/3/5/6', error: null },
        }),
      [`${api}/${eventId}/discord-post`]: () => Response.json(preview),
    });
    const user = userEvent.setup();
    renderRoute(`/guilds/${ashenId}/events/${eventId}`);

    await user.click(await screen.findByRole('tab', { name: 'Discord post' }));

    expect(
      await screen.findByText(
        'Preview of the message the bot posts in #raid-signups, in Spanish. It updates as people sign up.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Molten Core', { selector: 's' })).toBeInTheDocument();
    expect(screen.getByText('This event has been cancelled.').tagName).toBe('STRONG');
    expect(screen.getByText(/November 10, \d{4} at 4:00 PM/)).toBeInTheDocument();
    expect(screen.getByText('Tank', { selector: 'strong' }).parentElement?.tagName).toBe('U');
    expect(screen.getByText('1', { selector: 'code' })).toBeInTheDocument();
    expect(screen.getByAltText(':wgm_warrior:')).toHaveAttribute(
      'src',
      'https://cdn.discordapp.com/emojis/123.webp?size=44',
    );
    expect(screen.getByText('Inscribirse')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open in Discord/ })).toHaveAttribute(
      'href',
      'https://discord.com/channels/3/5/6',
    );
  });

  it("says why the bot couldn't post, and when there's no channel", async () => {
    const preview = {
      locale: 'en',
      embed: { title: 'Molten Core', color: 0, fields: [] },
      buttons: [],
    };
    mockApi({
      [`${api}/${eventId}`]: () =>
        Response.json({ ...saved, discordPost: { url: null, error: 'missing_permissions' } }),
      [`${api}/${eventId}/discord-post`]: () =>
        Response.json({ ...preview, channel: { id: '5', name: 'raid-signups' } }),
    });
    const user = userEvent.setup();
    const { unmount } = renderRoute(`/guilds/${ashenId}/events/${eventId}`);
    await user.click(await screen.findByRole('tab', { name: 'Discord post' }));

    expect(await screen.findByText("The bot couldn't post this event")).toBeInTheDocument();
    expect(
      screen.getByText(/needs to see, write, and post embeds in #raid-signups/),
    ).toBeInTheDocument();
    unmount();

    mockApi({
      [`/api/guilds/${ashenId}`]: () => Response.json({ ...testGuild, eventsChannel: null }),
      [`${api}/${eventId}`]: () => Response.json(saved),
      [`${api}/${eventId}/discord-post`]: () => Response.json({ ...preview, channel: null }),
    });
    renderRoute(`/guilds/${ashenId}/events/${eventId}`);
    await user.click(await screen.findByRole('tab', { name: 'Discord post' }));

    expect(await screen.findByText('No events channel yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose the channel' })).toHaveAttribute(
      'href',
      `/guilds/${ashenId}/settings`,
    );
  });

  describe('participants', () => {
    const signUp = (
      n: number,
      name: string,
      role: SignUpResponse['role'],
      placement: SignUpResponse['placement'],
      status: SignUpResponse['status'] = 'confirmed',
    ): SignUpResponse => ({
      id: `019a0c3e-5b1e-7c2a-9f3d-00000000080${n}`,
      memberId: `019a0c3e-5b1e-7c2a-9f3d-00000000070${n}`,
      character: {
        id: `019a0c3e-5b1e-7c2a-9f3d-00000000090${n}`,
        name,
        class: 'warrior',
        race: 'orc',
      },
      role,
      status,
      placement,
      signedUpAt: `${nextYear}-11-01T10:0${n}:00.000Z`,
    });
    const signUps = [
      signUp(1, 'Saurfang', 'tank', 'slot', 'tentative'),
      signUp(2, 'Grommash', 'tank', 'slot'),
      signUp(3, 'Rexxar', 'tank', 'waitlist'),
      signUp(4, 'Cairne', null, null, 'declined'),
    ];
    const small = {
      ...saved,
      size: 5,
      type: 'pvp' as const,
      slots: { tank: 2, healer: 1, dps: 2 },
    };

    it('shows participants by role, the waitlist, and who declined', async () => {
      mockApi({
        [`${api}/${eventId}`]: () => Response.json(small),
        [`${api}/${eventId}/sign-ups`]: () => Response.json(signUps),
      });
      renderRoute(`/guilds/${ashenId}/events/${eventId}`);

      const tanks = await screen.findByRole('region', { name: 'Tanks' });
      expect(await within(tanks).findByText('Saurfang')).toBeInTheDocument();
      expect(within(tanks).getByText('Tentative')).toBeInTheDocument();
      expect(within(tanks).getByText('2/2 filled')).toBeInTheDocument();
      const waitlist = within(tanks).getByRole('region', { name: 'Waitlist' });
      expect(within(waitlist).getByText('Rexxar')).toBeInTheDocument();
      expect(within(waitlist).getByText('#1')).toBeInTheDocument();
      const declined = screen.getByRole('region', { name: 'Declined (1)' });
      expect(within(declined).getByText('Cairne')).toBeInTheDocument();
      expect(
        within(screen.getByRole('region', { name: 'Healers' })).getByText('No one on the waitlist'),
      ).toBeInTheDocument();
    });

    it('removes a participant after asking', async () => {
      const fetchMock = mockApi({
        [`${api}/${eventId}`]: () => Response.json(small),
        [`${api}/${eventId}/sign-ups`]: () => Response.json(signUps),
        [`DELETE ${api}/${eventId}/sign-ups/${signUps[1]!.id}`]: () =>
          Response.json([signUps[0], { ...signUps[2], placement: 'slot' }, signUps[3]]),
      });
      const user = userEvent.setup();
      renderRoute(`/guilds/${ashenId}/events/${eventId}`);

      const tanks = await screen.findByRole('region', { name: 'Tanks' });
      await within(tanks).findByText('Grommash');
      await user.click(within(tanks).getAllByRole('button', { name: 'Remove' })[1]!);
      const dialog = await screen.findByRole('dialog', { name: 'Remove Grommash from the event?' });
      await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

      expect(await within(tanks).findByText('Rexxar')).toBeInTheDocument();
      expect(within(tanks).queryByText('Grommash')).not.toBeInTheDocument();
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
    });

    it('adds a participant, saying where they will end up', async () => {
      const member = (n: number, name: string, rank: RosterMember['rank']): RosterMember => ({
        id: `019a0c3e-5b1e-7c2a-9f3d-00000000070${n}`,
        discordUserId: `20000000000000000${n}`,
        discordName: name,
        avatarUrl: '',
        rank,
        baseRank: 'raider',
        leftDiscordAt: null,
        attendanceRate: null,
        attendanceBand: null,
        characters: [
          {
            id: `019a0c3e-5b1e-7c2a-9f3d-00000000110${n}`,
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
      const open = {
        ...small,
        type: 'raid' as const,
        tentativeDeadline: { at: `${nextYear}-11-09T19:00:00.000Z`, hours: 24, own: false },
      };
      const fetchMock = mockApi({
        [`${api}/${eventId}`]: () => Response.json(open),
        [`${api}/${eventId}/sign-ups`]: () => Response.json(signUps),
        [`/api/guilds/${ashenId}/members`]: () =>
          Response.json([member(5, 'Varok', 'raider'), member(6, 'Peon', 'member')]),
        [`POST ${api}/${eventId}/sign-ups`]: () => Response.json(signUps, { status: 201 }),
      });
      const user = userEvent.setup();
      renderRoute(`/guilds/${ashenId}/events/${eventId}`);

      await user.click(await screen.findByRole('button', { name: 'Add participant' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add participant' });
      const combo = within(dialog).getByRole('combobox', { name: 'Member' });
      await waitFor(() => expect(combo).toBeEnabled());
      await user.click(combo);
      // Members can't join raids, so they aren't offered.
      expect(screen.queryByRole('option', { name: /Peon/ })).not.toBeInTheDocument();
      await user.click(await screen.findByRole('option', { name: /Varok/ }));
      await user.click(within(dialog).getByRole('button', { name: 'Tank' }));
      expect(
        within(dialog).getByText('Tank is full, so they go to the end of its waitlist.'),
      ).toBeInTheDocument();
      await user.click(within(dialog).getByRole('button', { name: 'Tentative' }));
      await user.click(within(dialog).getByRole('button', { name: 'Add' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(JSON.parse(call![1]!.body as string)).toEqual({
        characterId: '019a0c3e-5b1e-7c2a-9f3d-000000001105',
        role: 'tank',
        status: 'tentative',
      });
    });

    it('asks before moving someone signed up to another role', async () => {
      const grommash: RosterMember = {
        id: signUps[1]!.memberId,
        discordUserId: '200000000000000002',
        discordName: 'Grom',
        avatarUrl: '',
        rank: 'raider',
        baseRank: 'raider',
        leftDiscordAt: null,
        attendanceRate: null,
        attendanceBand: null,
        characters: [
          { ...signUps[1]!.character, faction: 'horde', level: 60, professions: [], isMain: true },
        ],
      };
      const fetchMock = mockApi({
        [`${api}/${eventId}`]: () => Response.json(small),
        [`${api}/${eventId}/sign-ups`]: () => Response.json(signUps),
        [`/api/guilds/${ashenId}/members`]: () => Response.json([grommash]),
        [`POST ${api}/${eventId}/sign-ups`]: () => Response.json(signUps, { status: 201 }),
      });
      const user = userEvent.setup();
      renderRoute(`/guilds/${ashenId}/events/${eventId}`);

      await user.click(await screen.findByRole('button', { name: 'Add participant' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add participant' });
      const combo = within(dialog).getByRole('combobox', { name: 'Member' });
      await waitFor(() => expect(combo).toBeEnabled());
      await user.click(combo);
      await user.click(await screen.findByRole('option', { name: /Grom/ }));
      await user.click(within(dialog).getByRole('button', { name: 'DPS' }));
      await user.click(within(dialog).getByRole('button', { name: 'Add' }));

      const confirm = await screen.findByRole('dialog', {
        name: "Change Grommash's role to DPS?",
      });
      expect(within(confirm).getByText(/Grommash has a Tank slot/)).toBeInTheDocument();
      const posted = () => fetchMock.mock.calls.some(([, init]) => init?.method === 'POST');
      expect(posted()).toBe(false);
      await user.click(within(confirm).getByRole('button', { name: 'Change role' }));

      await waitFor(() => expect(posted()).toBe(true));
    });

    it('replaces a Tentative participant with a waitlisted character', async () => {
      const fetchMock = mockApi({
        [`${api}/${eventId}`]: () => Response.json(small),
        [`${api}/${eventId}/sign-ups`]: () => Response.json(signUps),
        [`POST ${api}/${eventId}/sign-ups/${signUps[0]!.id}/replace`]: () => Response.json(signUps),
      });
      const user = userEvent.setup();
      renderRoute(`/guilds/${ashenId}/events/${eventId}`);

      const tanks = await screen.findByRole('region', { name: 'Tanks' });
      await user.click(await within(tanks).findByRole('button', { name: 'Replace' }));
      const dialog = await screen.findByRole('dialog', { name: 'Replace Saurfang' });
      await user.click(within(dialog).getByRole('button', { name: 'Give the spot' }));

      const call = fetchMock.mock.calls.find(
        ([url]) => typeof url === 'string' && url.endsWith('/replace'),
      );
      expect(JSON.parse(call![1]!.body as string)).toEqual({ replacementId: signUps[2]!.id });
    });
  });
});
