import type { EventResponse, SeriesResponse } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loginAs, testApp } from '../../../test/api-app.js';
import { createTestGuild } from '../../../test/test-guild.js';
import { User } from '../../db/models/index.js';
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

async function setup() {
  const app = testApp();
  const agent = await loginAs(app, gm);
  const leader = (await User.findOne({ where: { discordId: gm } }))!;
  const guild = await createTestGuild(leader, { serverId: '300000000000000001' });
  return { agent, base: `/api/guilds/${guild.id}` };
}

describe('series', () => {
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
