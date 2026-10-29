import type { EventResponse, SeriesResponse } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loginAs, testApp } from '../../../test/api-app.js';
import {
  BOT_USER_ID,
  channel,
  FakeDiscordDirectory,
  SEND_MESSAGES,
  server,
} from '../../../test/fake-discord-directory.js';
import { FakeJobQueue } from '../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../test/test-guild.js';
import { Event, User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';

const gm = '200000000000000001';
const day = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * day).toISOString();
const details = { name: 'Molten Core', size: 40, slots: { tank: 4, healer: 10, dps: 26 } };

let sequelize: Sequelize;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
});

const ashen = '300000000000000001';
const raidsChannel = '500000000000000001';
const rulesChannel = '500000000000000002';

/** Discord with the guild's server, where the bot can post in #raids but not in #rules. */
function discordAccess() {
  const directory = new FakeDiscordDirectory()
    .addServer(server(ashen, 'Ashen'))
    .addChannels(ashen, [
      channel(raidsChannel, 'raids'),
      channel(rulesChannel, 'rules', {
        overwrites: [{ id: ashen, type: 'role', allow: 0n, deny: SEND_MESSAGES }],
      }),
    ]);
  return { directory, botInviteUrl: 'https://discord.test/invite', botUserId: BOT_USER_ID };
}

async function setup(discord: ReturnType<typeof discordAccess> | null = null) {
  const jobs = new FakeJobQueue();
  const app = testApp(discord, undefined, jobs);
  const agent = await loginAs(app, gm);
  const leader = (await User.findOne({ where: { discordId: gm } }))!;
  const guild = await createTestGuild(leader, { serverId: ashen });
  return { agent, jobs, base: `/api/guilds/${guild.id}` };
}

describe('series', () => {
  it('gives its start as the next event until its first event is created', async () => {
    const { agent, base } = await setup();
    const startsAt = inDays(30);

    const response = await agent
      .post(`${base}/series`)
      .send({ type: 'raid', ...details, startsAt });

    expect((response.body as SeriesResponse).nextEventAt).toBe(startsAt);
    expect((await agent.get(`${base}/events?scope=upcoming`)).body).toEqual([]);
  });

  it('creates a series with its events, each linked to it', async () => {
    const { agent, base } = await setup();
    const startsAt = inDays(1);

    const response = await agent
      .post(`${base}/series`)
      .send({ type: 'raid', ...details, startsAt });
    const series = response.body as SeriesResponse;
    const events = (await agent.get(`${base}/events?scope=upcoming`)).body as EventResponse[];

    expect(response.status).toBe(201);
    expect(series).toMatchObject({
      name: 'Molten Core',
      startsAt,
      nextEventAt: startsAt,
      stopped: null,
    });
    expect(events.map((event) => [event.startsAt, event.series])).toEqual([
      [startsAt, { id: series.id, name: 'Molten Core' }],
      [
        new Date(Date.parse(startsAt) + 7 * day).toISOString(),
        { id: series.id, name: 'Molten Core' },
      ],
    ]);
    expect(((await agent.get(`${base}/series`)).body as SeriesResponse[]).map((s) => s.id)).toEqual(
      [series.id],
    );
  });

  it('edits and stops a series', async () => {
    const { agent, base } = await setup();
    const series = (
      await agent.post(`${base}/series`).send({ type: 'raid', ...details, startsAt: inDays(1) })
    ).body as SeriesResponse;

    const edited = await agent
      .put(`${base}/series/${series.id}`)
      .send({ ...details, name: 'BWL', startsAt: inDays(2) });
    const stopped = await agent.post(`${base}/series/${series.id}/stop`);

    expect((edited.body as SeriesResponse).name).toBe('BWL');
    expect((stopped.body as SeriesResponse).stopped).toMatchObject({ by: 'User 0001' });
    expect((await agent.get(`${base}/events?scope=upcoming`)).body).toEqual([]);
    expect((await agent.get(`${base}/series`)).body).toEqual([]);
    expect((await agent.post(`${base}/series/${series.id}/stop`)).status).toBe(409);
  });
});

describe('Discord posts of a series', () => {
  it('asks for the posts of its events when it is created or edited', async () => {
    const { agent, jobs, base } = await setup();

    const created = await agent
      .post(`${base}/series`)
      .send({ type: 'raid', ...details, startsAt: inDays(1) });
    const ids = ((await agent.get(`${base}/events?scope=upcoming`)).body as EventResponse[]).map(
      (event) => ({ eventId: event.id }),
    );
    expect(jobs.payloads('event-post')).toEqual(ids);

    jobs.jobs.length = 0;
    await agent
      .put(`${base}/series/${(created.body as SeriesResponse).id}`)
      .send({ ...details, name: 'Blackwing Lair', startsAt: inDays(2) });
    expect(jobs.payloads('event-post')).toEqual(ids);
  });

  it('deletes the posts of the events it removes when stopped', async () => {
    const { agent, jobs, base } = await setup();
    const created = await agent
      .post(`${base}/series`)
      .send({ type: 'raid', ...details, startsAt: inDays(1) });
    const [first] = await Event.findAll({ order: [['startsAt', 'ASC']] });
    await first!.update({ discordChannelId: '500000000000000001', discordMessageId: '600' });

    await agent.post(`${base}/series/${(created.body as SeriesResponse).id}/stop`);

    expect(jobs.payloads('event-post-delete')).toEqual([
      { channelId: '500000000000000001', messageId: '600' },
    ]);
  });
});

describe("a series' channel", () => {
  it('lists the channels the bot can post in', async () => {
    const { agent, base } = await setup(discordAccess());

    const response = await agent.get(`${base}/channels`);

    expect(response.body).toEqual({
      channels: [{ id: raidsChannel, name: 'raids', category: null }],
    });
  });

  it('saves it with the series, and clears it', async () => {
    const { agent, base } = await setup(discordAccess());

    const created = await agent
      .post(`${base}/series`)
      .send({ type: 'raid', ...details, startsAt: inDays(1), channelId: raidsChannel });
    const series = created.body as SeriesResponse;
    expect(created.status).toBe(201);
    expect(series.channel).toEqual({ id: raidsChannel, name: 'raids' });
    expect(((await agent.get(`${base}/series`)).body as SeriesResponse[])[0]!.channel).toEqual({
      id: raidsChannel,
      name: 'raids',
    });

    const edited = await agent
      .put(`${base}/series/${series.id}`)
      .send({ ...details, startsAt: inDays(2), channelId: null });
    expect((edited.body as SeriesResponse).channel).toBeNull();
  });

  it("rejects a channel the bot can't post in", async () => {
    const { agent, base } = await setup(discordAccess());

    const response = await agent
      .post(`${base}/series`)
      .send({ type: 'raid', ...details, startsAt: inDays(1), channelId: rulesChannel });

    expect(response.status).toBe(400);
    expect((response.body as { error: { issues: unknown } }).error.issues).toEqual([
      { field: 'channelId', code: 'EVENTS_CHANNEL_NOT_USABLE' },
    ]);
    expect(await Event.count()).toBe(0);
  });

  it("can't be set while the API can't read Discord", async () => {
    const { agent, base } = await setup();

    const response = await agent
      .post(`${base}/series`)
      .send({ type: 'raid', ...details, startsAt: inDays(1), channelId: raidsChannel });

    expect(response.status).toBe(503);
  });
});
