import type { EventResponse } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loginAs, testApp } from '../../../test/api-app.js';
import { createTestGuild } from '../../../test/test-guild.js';
import { Event, User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';

const gm = '200000000000000001';
const day = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * day).toISOString();

const raid = {
  type: 'raid',
  name: 'Molten Core',
  description: 'Fire resistance gear.',
  size: 40,
  slots: { tank: 4, healer: 10, dps: 26 },
};

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

async function setup() {
  const app = testApp();
  const agent = await loginAs(app, gm);
  const leader = (await User.findOne({ where: { discordId: gm } }))!;
  const guild = await createTestGuild(leader, { serverId: '300000000000000001' });
  return { app, agent, base: `/api/guilds/${guild.id}/events`, guild };
}

const event = (response: { body: unknown }) => response.body as EventResponse;
const names = (response: { body: unknown }) =>
  (response.body as EventResponse[]).map((item) => item.name);

describe('events', () => {
  it('creates an event and answers with it', async () => {
    const { agent, base } = await setup();
    const startsAt = inDays(3);

    const response = await agent.post(base).send({ ...raid, startsAt });

    expect(response.status).toBe(201);
    expect(event(response)).toEqual({
      id: expect.any(String) as string,
      ...raid,
      startsAt,
      createdBy: 'User 0001',
      cancelled: null,
    });
    expect((await agent.get(`${base}/${event(response).id}`)).body).toEqual(response.body);
  });

  it('answers with the issues of an invalid event', async () => {
    const { agent, base } = await setup();

    const response = await agent.post(base).send({ ...raid, startsAt: inDays(3), size: 25 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        issues: [
          { field: 'size', code: 'INVALID_RAID_SIZE' },
          { field: 'slots', code: 'SLOTS_DONT_ADD_UP' },
        ],
      },
    });
  });

  it('lists upcoming events soonest first, past ones latest first, and a time range', async () => {
    const { agent, base, guild } = await setup();
    for (const [name, days] of [
      ['Later', 9],
      ['Soon', 2],
      ['Yesterday', -1],
      ['Last week', -7],
    ] as const) {
      await Event.create({
        guildId: guild.id,
        type: 'pvp',
        name,
        description: '',
        startsAt: new Date(inDays(days)),
        size: 10,
        tankSlots: 0,
        healerSlots: 2,
        dpsSlots: 8,
        createdByUserId: null,
      });
    }

    expect(names(await agent.get(`${base}?scope=upcoming`))).toEqual(['Soon', 'Later']);
    expect(names(await agent.get(`${base}?scope=past`))).toEqual(['Yesterday', 'Last week']);
    const range = await agent.get(base).query({ from: inDays(-8), to: inDays(3) });
    expect(names(range)).toEqual(['Last week', 'Yesterday', 'Soon']);
    expect((await agent.get(`${base}?scope=someday`)).status).toBe(400);
  });

  it('edits and cancels an event', async () => {
    const { agent, base } = await setup();
    const created = event(await agent.post(base).send({ ...raid, startsAt: inDays(3) }));
    const details = { name: raid.name, size: raid.size, slots: raid.slots };

    const edited = await agent
      .put(`${base}/${created.id}`)
      .send({ ...details, startsAt: inDays(4), name: 'Onyxia' });
    const cancelled = await agent.post(`${base}/${created.id}/cancel`);
    const again = await agent.post(`${base}/${created.id}/cancel`);

    expect(event(edited).name).toBe('Onyxia');
    expect(event(cancelled).cancelled).toEqual({
      at: expect.any(String) as string,
      by: 'User 0001',
    });
    expect(again.status).toBe(409);
    expect(again.body).toEqual({ error: { code: 'EVENT_CANCELLED' } });
  });

  it('answers 403 to someone without access, and 404 for an unknown event', async () => {
    const { app, agent, base } = await setup();
    const stranger = await loginAs(app, '200000000000000009');

    expect((await stranger.get(`${base}?scope=upcoming`)).status).toBe(403);
    expect((await agent.get(`${base}/not-an-id`)).status).toBe(404);
  });
});
