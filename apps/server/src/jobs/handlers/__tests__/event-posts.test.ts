import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeChannelMessages } from '../../../../test/fake-channel-messages.js';
import { FakeJobQueue } from '../../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../../test/test-guild.js';
import { Event, User, type Guild } from '../../../db/models/index.js';
import { createSequelize } from '../../../db/sequelize.js';
import { cancelEvent, createEvent } from '../../../domain/events.js';
import { createSeries } from '../../../domain/series.js';
import { postAt } from '../../../domain/series-posts.js';
import { scheduleEventJobs } from '../../event-jobs.js';
import { createTestLogger } from '../../../test-logger.js';
import {
  enqueueMissingEventPosts,
  enqueueSeriesEventPosts,
  enqueueUpcomingEventPosts,
  POST_EDIT_WINDOW_MS,
  scheduleEventPostUpdate,
} from '../../event-posts.js';
import { eventPostHandlers } from '../event-posts.js';

const raidsChannel = '500000000000000001';
const otherChannel = '500000000000000002';
const seriesChannel = '500000000000000003';
const hour = 60 * 60 * 1000;
const day = 24 * hour;

let sequelize: Sequelize;
let gm: User;
let guild: Guild;
let discord: FakeChannelMessages;
let handlers: ReturnType<typeof eventPostHandlers>;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
  gm = await User.create({ discordId: '200000000000000001', name: 'Garrosh', avatar: null });
  guild = await createTestGuild(gm, { serverId: '300000000000000001' });
  await guild.update({ eventsChannelId: raidsChannel });
  discord = new FakeChannelMessages();
  handlers = eventPostHandlers({ logger: createTestLogger().logger, channelMessages: discord });
});

function raid(startsAt = new Date(Date.now() + 3 * day)) {
  return createEvent(
    guild,
    {
      type: 'raid',
      name: 'Molten Core',
      description: 'Fire resistance gear.',
      startsAt: startsAt.toISOString(),
      size: 40,
      slots: { tank: 4, healer: 10, dps: 26 },
    },
    gm,
  );
}

/** A weekly raid in `channelId`, and its first event. */
async function weeklyRaid(channelId: string | null) {
  const series = await createSeries(
    guild,
    {
      type: 'raid',
      name: 'Weekly Molten Core',
      startsAt: new Date(Date.now() + 3 * day).toISOString(),
      size: 40,
      slots: { tank: 4, healer: 10, dps: 26 },
      channelId,
    },
    gm,
  );
  const [first] = await Event.findAll({
    where: { seriesId: series.id },
    order: [['startsAt', 'ASC']],
  });
  return { series, event: first! };
}

const sync = (event: Event) => handlers['event-post']({ eventId: event.id });

/** The embed of the only message in the channel. */
function onlyPost(channelId: string) {
  const messages = [...discord.messages(channelId).values()];
  expect(messages).toHaveLength(1);
  return messages[0]!.embeds![0]!;
}

describe('event-post', () => {
  it('posts the event in the events channel and remembers the post', async () => {
    const event = await raid();

    await sync(event);

    expect(onlyPost(raidsChannel).title).toBe('Molten Core');
    await event.reload();
    expect(event.discordChannelId).toBe(raidsChannel);
    expect(discord.messages(raidsChannel).has(event.discordMessageId!)).toBe(true);
  });

  it('edits the post instead of posting again', async () => {
    const event = await raid();
    await sync(event);

    await event.update({ name: 'Blackwing Lair' });
    await sync(event);

    expect(onlyPost(raidsChannel).title).toBe('Blackwing Lair');
  });

  it('never posts twice when two runs overlap', async () => {
    const event = await raid();

    await Promise.all([sync(event), sync(event), sync(event)]);

    expect(discord.messages(raidsChannel).size).toBe(1);
  });

  it('posts again when the post was deleted in Discord', async () => {
    const event = await raid();
    await sync(event);
    discord.messages(raidsChannel).clear();

    await sync(event);

    expect(onlyPost(raidsChannel).title).toBe('Molten Core');
  });

  it('puts Sign up and Declined buttons under the post', async () => {
    const event = await raid();

    await sync(event);

    const [message] = [...discord.messages(raidsChannel).values()];
    expect(message!.components![0]!.components).toMatchObject([
      { custom_id: `signup:open:${event.id}`, label: 'Sign up' },
      { custom_id: `signup:decline:${event.id}`, label: 'Declined' },
    ]);
  });

  it('marks the post of a cancelled event as cancelled', async () => {
    const event = await raid();
    await sync(event);

    await cancelEvent(guild, event.id, gm);
    await sync(event);

    expect(onlyPost(raidsChannel)).toMatchObject({
      title: '~~Molten Core~~',
      description: '**This event has been cancelled.**\n\nFire resistance gear.',
    });
    expect([...discord.messages(raidsChannel).values()][0]!.components).toEqual([]);
  });

  it("doesn't post a cancelled event that was never posted", async () => {
    const event = await raid();
    await cancelEvent(guild, event.id, gm);

    await sync(event);

    expect(discord.channels.size).toBe(0);
  });

  it('moves the post when the events channel changes', async () => {
    const event = await raid();
    await sync(event);

    await guild.update({ eventsChannelId: otherChannel });
    await sync(event);

    expect(discord.messages(raidsChannel).size).toBe(0);
    expect(onlyPost(otherChannel).title).toBe('Molten Core');
    expect((await event.reload()).discordChannelId).toBe(otherChannel);
  });

  it('removes the post when the guild has no events channel any more', async () => {
    const event = await raid();
    await sync(event);

    await guild.update({ eventsChannelId: null });
    await sync(event);

    expect(discord.messages(raidsChannel).size).toBe(0);
    expect((await event.reload()).discordMessageId).toBeNull();
  });

  it('does nothing while the guild has no events channel', async () => {
    await guild.update({ eventsChannelId: null });
    const event = await raid();

    await sync(event);

    expect(discord.channels.size).toBe(0);
  });

  it("posts in its type's channel instead of the events channel", async () => {
    await guild.update({ raidChannelId: otherChannel });
    const event = await raid();

    await sync(event);

    expect(discord.messages(raidsChannel).size).toBe(0);
    expect(onlyPost(otherChannel).title).toBe('Molten Core');
  });

  it("posts in its series' channel before its type's, even once edited on its own", async () => {
    await guild.update({ raidChannelId: otherChannel });
    const { event } = await weeklyRaid(seriesChannel);
    await event.update({ name: 'Molten Core (moved)' });

    await sync(event);

    expect(discord.messages(otherChannel).size).toBe(0);
    expect(onlyPost(seriesChannel).title).toBe('Molten Core (moved)');
  });

  it("moves the post when its type's channel is cleared, or its series' changes", async () => {
    await guild.update({ raidChannelId: otherChannel });
    const one = await raid();
    const { series, event: weekly } = await weeklyRaid(null);
    await sync(one);
    await sync(weekly);
    expect(discord.messages(otherChannel).size).toBe(2);

    await guild.update({ raidChannelId: null });
    await series.update({ channelId: seriesChannel });
    await sync(one);
    await sync(weekly);

    expect(discord.messages(otherChannel).size).toBe(0);
    expect(onlyPost(raidsChannel).title).toBe('Molten Core');
    expect(onlyPost(seriesChannel).title).toBe('Weekly Molten Core');
  });

  it('posts in the guild language', async () => {
    await guild.update({ discordLocale: 'es' });
    const event = await raid();

    await sync(event);

    expect(onlyPost(raidsChannel).fields.at(-1)?.name).toBe('Inscripciones');
  });

  it('stores why Discord refused, and clears it once the post works', async () => {
    const event = await raid();
    discord.refusing.set(raidsChannel, 'missing_permissions');

    await sync(event);
    expect((await event.reload()).discordPostError).toBe('missing_permissions');

    discord.refusing.clear();
    await sync(event);
    expect((await event.reload()).discordPostError).toBeNull();
    expect(discord.messages(raidsChannel).size).toBe(1);
  });

  it('throws when Discord is down, so the job is retried', async () => {
    const event = await raid();
    discord.down = true;

    await expect(sync(event)).rejects.toThrow('Discord is down');
    expect((await event.reload()).discordPostError).toBeNull();
  });

  it('does nothing for an event that no longer exists', async () => {
    const event = await raid();
    await event.destroy();

    await sync(event);

    expect(discord.channels.size).toBe(0);
  });

  it('does nothing without a bot token', async () => {
    const event = await raid();
    const noToken = eventPostHandlers({ logger: createTestLogger().logger, channelMessages: null });

    await noToken['event-post']({ eventId: event.id });

    expect((await event.reload()).discordMessageId).toBeNull();
  });
});

describe('event-post-delete', () => {
  it('deletes the post, and ignores one that is already gone', async () => {
    const messageId = await discord.post(raidsChannel, { embeds: [], components: [] });

    await handlers['event-post-delete']({ channelId: raidsChannel, messageId });
    await handlers['event-post-delete']({ channelId: raidsChannel, messageId });

    expect(discord.messages(raidsChannel).size).toBe(0);
  });
});

describe('enqueueing posts', () => {
  it('asks for the posts of upcoming events that are not cancelled', async () => {
    const upcoming = await raid();
    const cancelled = await raid(new Date(Date.now() + 4 * day));
    await cancelEvent(guild, cancelled.id, gm);
    const jobs = new FakeJobQueue();

    await enqueueUpcomingEventPosts(jobs, guild.id);

    expect(jobs.payloads('event-post')).toEqual([{ eventId: upcoming.id }]);
  });

  it("asks only for the given types' events, leaving out series with their own channel", async () => {
    const one = await raid();
    const { event: ownChannel } = await weeklyRaid(seriesChannel);
    const { series: noChannel } = await weeklyRaid(null);
    const weekly = await Event.findAll({ where: { seriesId: noChannel.id } });
    const jobs = new FakeJobQueue();

    await enqueueUpcomingEventPosts(jobs, guild.id, { types: ['raid'] });
    const ids = jobs.payloads('event-post').map(({ eventId }) => eventId);
    expect(ids.sort()).toEqual([one.id, ...weekly.map((event) => event.id)].sort());
    expect(ids).not.toContain(ownChannel.id);

    jobs.jobs.length = 0;
    await enqueueUpcomingEventPosts(jobs, guild.id, { types: ['pvp'] });
    expect(jobs.jobs).toEqual([]);
  });

  it('finds upcoming events that were never posted, but leaves failed ones alone', async () => {
    const posted = await raid();
    await sync(posted);
    const missing = await raid(new Date(Date.now() + 4 * day));
    const failed = await raid(new Date(Date.now() + 5 * day));
    await failed.update({ discordPostError: 'missing_permissions' });
    const jobs = new FakeJobQueue();

    await enqueueMissingEventPosts(jobs);

    expect(jobs.payloads('event-post')).toEqual([{ eventId: missing.id }]);
  });

  it('skips events without a channel at any level', async () => {
    await guild.update({ eventsChannelId: null, dungeonChannelId: otherChannel });
    await raid();
    const jobs = new FakeJobQueue();

    await enqueueMissingEventPosts(jobs);

    expect(jobs.jobs).toEqual([]);
  });

  it("finds unposted events with only their type's channel", async () => {
    await guild.update({ eventsChannelId: null, raidChannelId: otherChannel });
    const typed = await raid();
    const jobs = new FakeJobQueue();

    await enqueueMissingEventPosts(jobs);

    expect(jobs.payloads('event-post')).toEqual([{ eventId: typed.id }]);
  });

  it("finds unposted events with only their series' channel", async () => {
    await guild.update({ eventsChannelId: null });
    await raid();
    const { event } = await weeklyRaid(seriesChannel);
    const jobs = new FakeJobQueue();

    await enqueueMissingEventPosts(jobs);

    expect(jobs.payloads('event-post')).toEqual([{ eventId: event.id }]);
  });

  it('leaves out the events of a series until the one before finishes, cancelled or not', async () => {
    const { series, event: first } = await weeklyRaid(null);
    const [, second] = await Event.findAll({
      where: { seriesId: series.id },
      order: [['startsAt', 'ASC']],
    });
    await cancelEvent(guild, first.id, gm);
    const jobs = new FakeJobQueue();

    await enqueueMissingEventPosts(jobs);
    expect(jobs.payloads('event-post')).toEqual([]);

    // 12 hours after the first one would have started, the second one can be posted.
    await enqueueMissingEventPosts(jobs, new Date(first.startsAt.getTime() + 12 * hour + 1));
    expect(jobs.payloads('event-post')).toEqual([{ eventId: second!.id }]);
  });
});

describe('the events of a series', () => {
  it('are posted one at a time: the next one waits for the one before it to finish', async () => {
    const { series, event: first } = await weeklyRaid(null);
    const [, second] = await Event.findAll({
      where: { seriesId: series.id },
      order: [['startsAt', 'ASC']],
    });

    await sync(first);
    await sync(second!);

    expect(discord.messages(raidsChannel).size).toBe(1);
    expect((await second!.reload()).discordMessageId).toBeNull();
    expect(await postAt(second!)).toEqual(new Date(first.startsAt.getTime() + 12 * hour));
    expect(await postAt(second!, new Date(first.startsAt.getTime() + 12 * hour + 1))).toBeNull();
  });

  it('keep a post they already have', async () => {
    const { series } = await weeklyRaid(null);
    const [, second] = await Event.findAll({
      where: { seriesId: series.id },
      order: [['startsAt', 'ASC']],
    });
    await second!.update({
      discordChannelId: raidsChannel,
      discordMessageId: '600000000000000009',
    });
    discord.messages(raidsChannel).set('600000000000000009', { content: 'old' });

    await sync(second!);

    expect((await second!.reload()).discordMessageId).toBe('600000000000000009');
  });

  it('get a job that posts the next one when each finishes, which a cancelled one keeps', async () => {
    const { series, event: first } = await weeklyRaid(null);
    const jobs = new FakeJobQueue();
    await scheduleEventJobs(jobs, [first.id]);
    await cancelEvent(guild, first.id, gm);
    await scheduleEventJobs(jobs, [first.id]);

    expect(jobs.job(`series-event-finished-${first.id}`)).toMatchObject({
      data: { seriesId: series.id },
      runAt: new Date(first.startsAt.getTime() + 12 * hour),
    });
  });

  it('when one finishes, the unposted ones are brought up to date', async () => {
    const { series, event: first } = await weeklyRaid(null);
    const others = await Event.findAll({ where: { seriesId: series.id } });
    await first.update({ discordChannelId: raidsChannel, discordMessageId: '600000000000000001' });
    const jobs = new FakeJobQueue();

    await enqueueSeriesEventPosts(jobs, series.id);

    const ids = jobs.payloads('event-post').map(({ eventId }) => eventId);
    expect(ids.sort()).toEqual(
      others
        .filter((event) => event.id !== first.id)
        .map((event) => event.id)
        .sort(),
    );
  });
});

describe('scheduleEventPostUpdate', () => {
  it('gathers the sign-ups of one window into one edit, and starts a new one after', async () => {
    const jobs = new FakeJobQueue();
    const start = 1_800_000_000_000;

    for (let ms = 0; ms < POST_EDIT_WINDOW_MS; ms += 100) {
      await scheduleEventPostUpdate(jobs, 'event-1', start + ms);
    }
    await scheduleEventPostUpdate(jobs, 'event-1', start + POST_EDIT_WINDOW_MS);
    await scheduleEventPostUpdate(jobs, 'event-2', start);

    expect(jobs.jobs.map(({ data, runAt }) => [data, runAt!.getTime() - start])).toEqual([
      [{ eventId: 'event-1' }, POST_EDIT_WINDOW_MS],
      [{ eventId: 'event-1' }, 2 * POST_EDIT_WINDOW_MS],
      [{ eventId: 'event-2' }, POST_EDIT_WINDOW_MS],
    ]);
  });
});
