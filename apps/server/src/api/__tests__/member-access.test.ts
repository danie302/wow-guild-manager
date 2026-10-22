import type { EventResponse, MeResponse, MemberDetailResponse, RosterMember } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loginAs, testApp } from '../../../test/api-app.js';
import { createTestGuild } from '../../../test/test-guild.js';
import { Event, Member, User, type Guild } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { addMember, addOfficerNote } from '../../domain/roster.js';

const gmId = '200000000000000001';
const thrall = { discordUserId: '200000000000000002', discordName: 'Thrall', discordAvatar: null };
const jaina = { discordUserId: '200000000000000003', discordName: 'Jaina', discordAvatar: null };
const day = 24 * 60 * 60 * 1000;

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

function event(guild: Guild, name: string, days: number) {
  const startsAt = new Date(Date.now() + days * day);
  return Event.create({
    guildId: guild.id,
    type: 'raid',
    name,
    description: '',
    startsAt,
    tentativeDeadlineAt: startsAt,
    size: 10,
    tankSlots: 1,
    healerSlots: 2,
    dpsSlots: 7,
    createdByUserId: null,
    discordPostError: 'missing_permissions',
  });
}

async function setup() {
  const app = testApp();
  await loginAs(app, gmId);
  const gm = (await User.findOne({ where: { discordId: gmId } }))!;
  const guild = await createTestGuild(gm, { serverId: '300000000000000001', name: 'Orgrimmar' });
  const { member: thrallMember } = await addMember(guild, thrall, 'raider', gm);
  const { member: jainaMember } = await addMember(guild, jaina, 'member', gm);
  await jainaMember.update({ leftDiscordAt: new Date() });
  await addOfficerNote(thrallMember, gm, 'Great healer, often late.');
  const upcoming = await event(guild, 'Upcoming', 3);
  const past = await event(guild, 'Past', -3);
  const agent = await loginAs(app, thrall.discordUserId);
  return {
    app,
    agent,
    guild,
    thrallMember,
    jainaMember,
    upcoming,
    past,
    base: `/api/guilds/${guild.id}`,
  };
}

describe('read-only member access', () => {
  it('lets a roster member open the guild read-only', async () => {
    const { agent, guild } = await setup();

    const me = (await agent.get('/api/me')).body as MeResponse;

    expect(me.guilds).toEqual([expect.objectContaining({ id: guild.id, access: 'member' })]);
  });

  it("refuses members who left the Discord server, and people who aren't on the roster", async () => {
    const { app, base } = await setup();

    const left = await loginAs(app, jaina.discordUserId);
    const stranger = await loginAs(app, '200000000000000099');

    expect(((await left.get('/api/me')).body as MeResponse).guilds).toEqual([]);
    expect((await left.get(`${base}/events?scope=upcoming`)).status).toBe(403);
    expect((await stranger.get(`${base}/members`)).status).toBe(403);
  });

  it('shows only upcoming events, without what only Officers can fix', async () => {
    const { agent, base, upcoming, past } = await setup();

    const list = (await agent.get(`${base}/events?scope=upcoming`)).body as EventResponse[];
    const pastList = (await agent.get(`${base}/events?scope=past`)).body as EventResponse[];
    const range = (
      await agent.get(`${base}/events`).query({
        from: new Date(Date.now() - 10 * day).toISOString(),
        to: new Date(Date.now() + 10 * day).toISOString(),
      })
    ).body as EventResponse[];

    expect(list.map((e) => e.name)).toEqual(['Upcoming']);
    expect(list[0]!.discordPost.error).toBeNull();
    expect(pastList).toEqual([]);
    expect(range.map((e) => e.name)).toEqual(['Upcoming']);
    expect((await agent.get(`${base}/events/${past.id}`)).status).toBe(404);
    expect((await agent.get(`${base}/events/${past.id}/sign-ups`)).status).toBe(404);
    expect((await agent.get(`${base}/events/${upcoming.id}/sign-ups`)).status).toBe(200);
  });

  it('shows the roster without who left Discord, and only their own page, without notes or history', async () => {
    const { agent, base, thrallMember, jainaMember } = await setup();

    const roster = (await agent.get(`${base}/members`)).body as RosterMember[];
    const own = (await agent.get(`${base}/members/${thrallMember.id}`))
      .body as MemberDetailResponse;

    expect(roster.every((member) => member.leftDiscordAt === null)).toBe(true);
    expect(roster.map((member) => member.discordName)).toContain('Jaina');
    expect(own).toMatchObject({ discordName: 'Thrall', officerNotes: [], rankHistory: [] });
    expect(JSON.stringify(own)).not.toContain('often late');
    expect((await agent.get(`${base}/members/${jainaMember.id}`)).status).toBe(404);
    expect((await agent.get(`${base}/members/${thrallMember.id}/attendance`)).status).toBe(200);
    expect((await agent.get(`${base}/members/${jainaMember.id}/attendance`)).status).toBe(404);
  });

  it("can't open the officers' pages, nor change anything", async () => {
    const { agent, base, upcoming, thrallMember } = await setup();
    const event = `${base}/events/${upcoming.id}`;

    const refused = await Promise.all([
      agent.get(base),
      agent.get(`${base}/dashboard`),
      agent.get(`${base}/attendance`),
      agent.get(`${base}/series`),
      agent.get(`${base}/registrations`),
      agent.get(`${base}/transfer-candidates`),
      agent.get(`${event}/attendance`),
      agent.get(`${event}/discord-post`),
      agent.patch(base).field('name', 'Mine'),
      agent.post(`${base}/events`).send({}),
      agent.put(event).send({}),
      agent.post(`${event}/cancel`),
      agent.post(`${event}/sign-ups`).send({}),
      agent.put(`${event}/attendance`).send({ records: [] }),
      agent.post(`${base}/series`).send({}),
      agent.post(`${base}/members`).send({}),
      agent.patch(`${base}/members/${thrallMember.id}`).send({ rank: 'member' }),
      agent.delete(`${base}/members/${thrallMember.id}`),
      agent.post(`${base}/members/${thrallMember.id}/notes`).send({ text: 'hi' }),
      agent.post(`${base}/members/${thrallMember.id}/characters`).send({}),
      agent.put(`${base}/members/${thrallMember.id}/main`).send({}),
      agent.post(`${base}/transfer`).send({ memberId: thrallMember.id }),
      agent.post(`${base}/disband`).send({ name: 'Orgrimmar' }),
    ]);

    expect(refused.map((response) => response.status)).toEqual(refused.map(() => 403));
    expect(await Member.count()).toBe(3);
  });
});
