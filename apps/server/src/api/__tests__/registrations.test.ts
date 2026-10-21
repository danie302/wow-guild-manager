import type { PendingRegistration } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loginAs, testApp } from '../../../test/api-app.js';
import { FakeJobQueue } from '../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../test/test-guild.js';
import { CharacterRegistration, Member, User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { lookUpRegistration, registerCharacter } from '../../domain/registrations.js';
import { FakeCharacterLookup } from '../../../test/fake-character-lookup.js';

const gm = '200000000000000001';
const thrall = { discordUserId: '200000000000000002', discordName: 'Thrall', discordAvatar: null };
const serverId = '300000000000000001';

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

/** A Horde guild led by `gm`, logged in, with Thrall's registration of "Thrall". */
async function setup() {
  const jobs = new FakeJobQueue();
  const app = testApp(null, undefined, jobs);
  const agent = await loginAs(app, gm);
  const guild = await createTestGuild((await User.findOne({ where: { discordId: gm } }))!, {
    serverId,
  });
  const outcome = await registerCharacter(serverId, thrall, 'Thrall', 'en');
  if (outcome.result !== 'created') throw new Error(outcome.result);
  const base = `/api/guilds/${guild.id}/registrations`;
  return { app, agent, jobs, guild, base, registration: outcome.registration };
}

describe('pending registrations', () => {
  it('lists them with what the lookup found', async () => {
    const { agent, base, registration } = await setup();
    await lookUpRegistration(registration.id, new FakeCharacterLookup());

    const response = await agent.get(base);

    expect(response.status).toBe(200);
    expect(response.body as PendingRegistration[]).toEqual([
      {
        id: registration.id,
        name: 'Thrall',
        discordUserId: thrall.discordUserId,
        discordName: 'Thrall',
        avatarUrl: expect.stringContaining('https://cdn.discordapp.com/') as string,
        onRoster: false,
        registeredAt: registration.createdAt.toISOString(),
        lookup: 'not_found',
        lookedUpAt: '2026-11-05T12:00:00.000Z',
        character: null,
      },
    ]);
  });

  it('answers 403 to someone without access', async () => {
    const { app, base } = await setup();

    const stranger = await loginAs(app, '200000000000000009');

    expect((await stranger.get(base)).status).toBe(403);
  });
});

describe('approving a registration', () => {
  it('adds the member and character, and queues the direct message', async () => {
    const { agent, base, jobs, registration } = await setup();

    const response = await agent
      .post(`${base}/${registration.id}/approve`)
      .send({ race: 'orc', class: 'shaman', level: 60, professions: ['alchemy'] });

    expect(response.status).toBe(204);
    expect(await Member.count({ where: { discordUserId: thrall.discordUserId } })).toBe(1);
    expect(jobs.payloads('registration-reviewed')).toEqual([{ registrationId: registration.id }]);
    expect((await agent.get(base)).body).toEqual([]);
  });

  it('answers with the missing fields of a character the lookup did not find', async () => {
    const { agent, base, jobs, registration } = await setup();

    const response = await agent.post(`${base}/${registration.id}/approve`).send({ level: 60 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        issues: [
          { field: 'race', code: 'REQUIRED' },
          { field: 'class', code: 'REQUIRED' },
        ],
      },
    });
    expect(jobs.jobs).toEqual([]);
  });

  it('answers 409 once it was reviewed, and 404 for an unknown one', async () => {
    const { agent, base, registration } = await setup();
    await agent.post(`${base}/${registration.id}/reject`);

    const again = await agent.post(`${base}/${registration.id}/approve`).send({});
    const unknown = await agent.post(`${base}/not-an-id/approve`).send({});

    expect(again.status).toBe(409);
    expect(again.body).toEqual({ error: { code: 'REGISTRATION_NOT_PENDING' } });
    expect(unknown.status).toBe(404);
  });
});

describe('rejecting a registration', () => {
  it('records who rejected it and queues the direct message', async () => {
    const { agent, base, jobs, registration } = await setup();

    const response = await agent.post(`${base}/${registration.id}/reject`);

    expect(response.status).toBe(204);
    await registration.reload();
    expect(registration.status).toBe('rejected');
    expect(registration.reviewedByUserId).toBe(
      (await User.findOne({ where: { discordId: gm } }))!.id,
    );
    expect(jobs.payloads('registration-reviewed')).toEqual([{ registrationId: registration.id }]);
    expect(await CharacterRegistration.count({ where: { status: 'pending' } })).toBe(0);
  });
});
