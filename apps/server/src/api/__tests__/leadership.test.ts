import type { TransferCandidate } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loginAs, testApp } from '../../../test/api-app.js';
import { FakeJobQueue } from '../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../test/test-guild.js';
import {
  Attendance,
  Character,
  Event,
  Guild,
  Member,
  RankChange,
  SignUp,
  User,
} from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { replaceGuildOfficers } from '../../domain/officers.js';
import { addMember } from '../../domain/roster.js';

const gmId = '200000000000000001';
const thrall = { discordUserId: '200000000000000002', discordName: 'Thrall', discordAvatar: null };
const jaina = { discordUserId: '200000000000000003', discordName: 'Jaina', discordAvatar: null };

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
  const jobs = new FakeJobQueue();
  const app = testApp(null, undefined, jobs);
  const agent = await loginAs(app, gmId);
  const gm = (await User.findOne({ where: { discordId: gmId } }))!;
  const guild = await createTestGuild(gm, { serverId: '300000000000000001', name: 'Orgrimmar' });
  const { member } = await addMember(guild, thrall, 'raider', gm);
  await addMember(guild, jaina, 'member', gm);
  return { app, agent, jobs, gm, guild, member, base: `/api/guilds/${guild.id}` };
}

describe('transferring leadership', () => {
  it('makes another member the Guild Master, and the old one a Raider', async () => {
    const { app, agent, guild, member, base } = await setup();

    const candidates = (await agent.get(`${base}/transfer-candidates`)).body as TransferCandidate[];
    expect(candidates.map((candidate) => candidate.discordName)).toEqual(['Jaina', 'Thrall']);

    const response = await agent.post(`${base}/transfer`).send({ memberId: member.id });

    expect(response.status).toBe(204);
    const newLeader = (await User.findOne({ where: { discordId: thrall.discordUserId } }))!;
    expect((await guild.reload()).guildMasterUserId).toBe(newLeader.id);
    const old = (await Member.findOne({ where: { discordUserId: gmId } }))!;
    expect(old.rank).toBe('raider');
    const history = await RankChange.findAll({ order: [['createdAt', 'ASC']] });
    expect(history.slice(-2).map((change) => [change.fromRank, change.toRank])).toEqual([
      ['raider', 'guild_master'],
      ['guild_master', 'raider'],
    ]);
    // The old Guild Master is now just a Raider: the settings are out of reach.
    expect((await agent.post(`${base}/transfer`).send({ memberId: member.id })).status).toBe(403);
    // The new one, logging in for the first time, finds the guild theirs.
    const thrallAgent = await loginAs(app, thrall.discordUserId);
    expect((await thrallAgent.get(base)).body).toMatchObject({ access: 'guild_master' });
  });

  it("refuses someone who already leads a guild, and isn't for Officers", async () => {
    const { app, agent, member, base } = await setup();
    const thrallUser = await User.create({
      discordId: thrall.discordUserId,
      name: 'Thrall',
      avatar: null,
    });
    await createTestGuild(thrallUser, { serverId: '300000000000000002', name: 'Durotar' });
    const candidates = (await agent.get(`${base}/transfer-candidates`)).body as TransferCandidate[];

    expect(candidates.find((candidate) => candidate.memberId === member.id)?.leads).toBe('Durotar');
    expect((await agent.post(`${base}/transfer`).send({ memberId: member.id })).body).toEqual({
      error: { code: 'ALREADY_LEADS_GUILD' },
    });

    const guild = (await Guild.findOne({ where: { name: 'Orgrimmar' } }))!;
    await replaceGuildOfficers(guild.id, [jaina.discordUserId]);
    const officer = await loginAs(app, jaina.discordUserId);
    expect((await officer.post(`${base}/transfer`).send({ memberId: member.id })).status).toBe(403);
  });
});

describe('disbanding', () => {
  it('needs the guild name, then deletes everything and makes the bot leave', async () => {
    const { agent, jobs, gm, guild, member, base } = await setup();
    const event = await Event.create({
      guildId: guild.id,
      type: 'raid',
      name: 'Molten Core',
      description: '',
      startsAt: new Date(Date.now() - 1000),
      tentativeDeadlineAt: new Date(),
      size: 10,
      tankSlots: 1,
      healerSlots: 2,
      dpsSlots: 7,
      createdByUserId: gm.id,
    });
    const character = await Character.create({
      memberId: member.id,
      name: 'Thrall',
      faction: 'horde',
      race: 'orc',
      characterClass: 'shaman',
      level: 60,
      professions: [],
      isMain: true,
    });
    await SignUp.create({
      eventId: event.id,
      memberId: member.id,
      characterId: character.id,
      role: 'healer',
      status: 'confirmed',
      placement: 'slot',
      signedUpAt: new Date(),
    });
    await Attendance.create({
      eventId: event.id,
      memberId: member.id,
      characterId: character.id,
      status: 'present',
    });

    const wrong = await agent.post(`${base}/disband`).send({ name: 'Orgrimar' });
    expect(wrong.body).toEqual({
      error: { code: 'VALIDATION_ERROR', issues: [{ field: 'name', code: 'NAME_DOESNT_MATCH' }] },
    });

    const response = await agent.post(`${base}/disband`).send({ name: ' Orgrimmar ' });

    expect(response.status).toBe(204);
    expect(await Guild.count()).toBe(0);
    expect(await Member.count()).toBe(0);
    expect(await Event.count()).toBe(0);
    expect(await Attendance.count()).toBe(0);
    expect(await SignUp.count()).toBe(0);
    expect(await Character.count()).toBe(0);
    expect(jobs.payloads('leave-server')).toEqual([{ discordServerId: '300000000000000001' }]);
    // They can lead a new guild now.
    expect((await agent.get('/api/me')).body).toMatchObject({ canCreateGuild: true, guilds: [] });
  });
});
