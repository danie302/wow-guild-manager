import type { EventDiscordPostResponse, EventResponse } from '@wgm/shared';
import { screen, within } from '@testing-library/react';
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
          { name: 'Tank (0/4)', value: '—', inline: true },
        ],
      },
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
    expect(screen.getByText('Tank (0/4)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open in Discord/ })).toHaveAttribute(
      'href',
      'https://discord.com/channels/3/5/6',
    );
  });

  it("says why the bot couldn't post, and when there's no channel", async () => {
    const preview = { locale: 'en', embed: { title: 'Molten Core', color: 0, fields: [] } };
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
});
