import type { ApproveRegistrationResponse, PendingRegistration } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loginAs, testApp } from '../../../test/api-app.js';
import { FakeJobQueue } from '../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../test/test-guild.js';
import { Member, Registration, User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { requestToJoin } from '../../domain/registrations.js';
import { addMember, removeMember } from '../../domain/roster.js';

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

/** A Horde guild led by `gm`, logged in. `request()` makes Thrall ask to join. */
async function setup() {
  const jobs = new FakeJobQueue();
  const app = testApp(null, undefined, jobs);
  const agent = await loginAs(app, gm);
  const leader = (await User.findOne({ where: { discordId: gm } }))!;
  const guild = await createTestGuild(leader, { serverId });
  const request = async () => {
    const outcome = await requestToJoin(serverId, thrall, 'en');
    if (outcome.result !== 'created') throw new Error(outcome.result);
    return outcome.registration;
  };
  const base = `/api/guilds/${guild.id}/registrations`;
  return { app, agent, jobs, guild, leader, base, request };
}

describe('pending requests', () => {
  it('lists them, saying who is returning to the roster', async () => {
    const { agent, base, guild, leader, request } = await setup();
    const { member } = await addMember(guild, thrall, 'raider', leader);
    await removeMember(member, guild);
    const registration = await request();

    const response = await agent.get(base);

    expect(response.status).toBe(200);
    expect(response.body as PendingRegistration[]).toEqual([
      {
        id: registration.id,
        discordUserId: thrall.discordUserId,
        discordName: 'Thrall',
        avatarUrl: expect.stringContaining('https://cdn.discordapp.com/') as string,
        onRoster: false,
        returning: true,
        requestedAt: registration.createdAt.toISOString(),
      },
    ]);
  });

  it('answers 403 to someone without access', async () => {
    const { app, base } = await setup();

    const stranger = await loginAs(app, '200000000000000009');

    expect((await stranger.get(base)).status).toBe(403);
  });
});

describe('approving a request', () => {
  it('adds them to the roster and queues the direct message', async () => {
    const { agent, base, jobs, request } = await setup();
    const registration = await request();

    const response = await agent.post(`${base}/${registration.id}/approve`);

    const member = await Member.findOne({ where: { discordUserId: thrall.discordUserId } });
    expect(response.status).toBe(200);
    expect(response.body as ApproveRegistrationResponse).toEqual({
      memberId: member!.id,
      restored: false,
    });
    expect(jobs.payloads('registration-reviewed')).toEqual([{ registrationId: registration.id }]);
    expect((await agent.get(base)).body).toEqual([]);
  });

  it('answers 409 once it was reviewed, and 404 for an unknown one', async () => {
    const { agent, base, request } = await setup();
    const registration = await request();
    await agent.post(`${base}/${registration.id}/reject`);

    const again = await agent.post(`${base}/${registration.id}/approve`);
    const unknown = await agent.post(`${base}/not-an-id/approve`);

    expect(again.status).toBe(409);
    expect(again.body).toEqual({ error: { code: 'REGISTRATION_NOT_PENDING' } });
    expect(unknown.status).toBe(404);
  });
});

describe('rejecting a request', () => {
  it('records who rejected it and queues the direct message', async () => {
    const { agent, base, jobs, leader, request } = await setup();
    const registration = await request();

    const response = await agent.post(`${base}/${registration.id}/reject`);

    expect(response.status).toBe(204);
    await registration.reload();
    expect(registration).toMatchObject({ status: 'rejected', reviewedByUserId: leader.id });
    expect(jobs.payloads('registration-reviewed')).toEqual([{ registrationId: registration.id }]);
    expect(await Registration.count({ where: { status: 'pending' } })).toBe(0);
  });
});
