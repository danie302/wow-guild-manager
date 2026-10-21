import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeChannelMessages } from '../../../../test/fake-channel-messages.js';
import { FakeJobQueue } from '../../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../../test/test-guild.js';
import { Event, User, type Guild } from '../../../db/models/index.js';
import { createSequelize } from '../../../db/sequelize.js';
import { cancelEvent, createEvent } from '../../../domain/events.js';
import { createTestLogger } from '../../../test-logger.js';
import { enqueueMissingEventPosts, enqueueUpcomingEventPosts } from '../../event-posts.js';
import { eventPostHandlers } from '../event-posts.js';

const raidsChannel = '500000000000000001';
const otherChannel = '500000000000000002';
const day = 24 * 60 * 60 * 1000;

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

const sync = (event: Event) => handlers['event-post']({ eventId: event.id });

/** The embed of the only message in the channel. */
function onlyPost(channelId: string) {
  const messages = [...discord.messages(channelId).values()];
  expect(messages).toHaveLength(1);
  return messages[0]!.embeds[0]!;
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

  it('marks the post of a cancelled event as cancelled', async () => {
    const event = await raid();
    await sync(event);

    await cancelEvent(guild, event.id, gm);
    await sync(event);

    expect(onlyPost(raidsChannel)).toMatchObject({
      title: '~~Molten Core~~',
      description: '**This event has been cancelled.**\n\nFire resistance gear.',
    });
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

  it('posts in the guild language', async () => {
    await guild.update({ discordLocale: 'es' });
    const event = await raid();

    await sync(event);

    expect(onlyPost(raidsChannel).fields[0]?.name).toBe('Fecha');
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
    const messageId = await discord.post(raidsChannel, { embeds: [] });

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

  it('skips guilds without an events channel', async () => {
    await guild.update({ eventsChannelId: null });
    await raid();
    const jobs = new FakeJobQueue();

    await enqueueMissingEventPosts(jobs);

    expect(jobs.jobs).toEqual([]);
  });
});
