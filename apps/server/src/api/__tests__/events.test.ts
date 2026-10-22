import type { EventDiscordPostResponse, EventResponse, SignUpResponse } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loginAs, testApp } from '../../../test/api-app.js';
import { FakeJobQueue } from '../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../test/test-guild.js';
import { Character, Event, Member, SignUp, User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { replaceGuildOfficers } from '../../domain/officers.js';

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
  const jobs = new FakeJobQueue();
  const app = testApp(null, undefined, jobs);
  const agent = await loginAs(app, gm);
  const leader = (await User.findOne({ where: { discordId: gm } }))!;
  const guild = await createTestGuild(leader, { serverId: '300000000000000001' });
  return { app, agent, jobs, base: `/api/guilds/${guild.id}/events`, guild };
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
      series: null,
      tentativeDeadline: {
        at: new Date(Date.parse(startsAt) - 24 * 60 * 60 * 1000).toISOString(),
        hours: 24,
        own: false,
      },
      discordPost: { url: null, error: null },
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
        tentativeDeadlineAt: new Date(inDays(days - 1)),
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

describe('Discord posts of events', () => {
  it('asks for the post when an event is created, edited, or cancelled', async () => {
    const { agent, jobs, base } = await setup();

    const created = await agent.post(base).send({ ...raid, startsAt: inDays(3) });
    const id = event(created).id;
    const details = { name: 'Onyxia', size: raid.size, slots: raid.slots };
    await agent.put(`${base}/${id}`).send({ ...details, startsAt: inDays(3) });
    await agent.post(`${base}/${id}/cancel`);

    expect(jobs.payloads('event-post')).toEqual([
      { eventId: id },
      { eventId: id },
      { eventId: id },
    ]);
  });

  it("links to the post once it's posted, and says why it failed", async () => {
    const { agent, base, guild } = await setup();
    const id = event(await agent.post(base).send({ ...raid, startsAt: inDays(3) })).id;

    await Event.update(
      {
        discordChannelId: '500000000000000001',
        discordMessageId: '600000000000000001',
        discordPostError: 'missing_permissions',
      },
      { where: { id } },
    );

    expect(event(await agent.get(`${base}/${id}`)).discordPost).toEqual({
      url: `https://discord.com/channels/${guild.discordServerId}/500000000000000001/600000000000000001`,
      error: 'missing_permissions',
    });
  });

  it('previews the post in the guild language', async () => {
    const { agent, base, guild } = await setup();
    await guild.update({ discordLocale: 'es' });
    const id = event(await agent.post(base).send({ ...raid, startsAt: inDays(3) })).id;

    const response = await agent.get(`${base}/${id}/discord-post`);
    const preview = response.body as EventDiscordPostResponse;

    expect(response.status).toBe(200);
    expect(preview).toMatchObject({ channel: null, locale: 'es' });
    expect(preview.embed.title).toBe('Molten Core');
    expect(preview.embed.fields.at(-1)?.name).toBe('Inscripciones');
    expect(preview.buttons.map((button) => button.label)).toEqual(['Inscribirse', 'Rechazado']);
  });
});

describe('sign-ups of an event', () => {
  it('lists them, and tells the people an edit moves or reschedules', async () => {
    const { agent, jobs, base, guild } = await setup();
    const pvp = {
      type: 'pvp',
      name: 'Arathi Basin',
      size: 3,
      slots: { tank: 1, healer: 1, dps: 1 },
    };
    const id = event(await agent.post(base).send({ ...pvp, startsAt: inDays(3) })).id;
    const member = await Member.create({
      guildId: guild.id,
      discordUserId: '200000000000000002',
      discordName: 'Thrall',
      discordAvatar: null,
      rank: 'raider',
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
    const signUp = await SignUp.create({
      eventId: id,
      memberId: member.id,
      characterId: character.id,
      role: 'healer',
      status: 'tentative',
      placement: 'slot',
      signedUpAt: new Date(),
    });

    const listed = await agent.get(`${base}/${id}/sign-ups`);
    expect(listed.body).toEqual([
      {
        id: signUp.id,
        character: { id: character.id, name: 'Thrall', class: 'shaman', race: 'orc' },
        role: 'healer',
        status: 'tentative',
        placement: 'slot',
        signedUpAt: signUp.signedUpAt.toISOString(),
      },
    ] satisfies SignUpResponse[]);

    jobs.jobs.length = 0;
    await agent.put(`${base}/${id}`).send({
      name: pvp.name,
      size: 3,
      slots: { tank: 1, healer: 0, dps: 2 },
      startsAt: inDays(4),
    });

    expect(jobs.payloads('moved-to-waitlist')).toEqual([{ signUpId: signUp.id }]);
    expect(jobs.payloads('events-rescheduled')).toEqual([{ memberId: member.id, eventIds: [id] }]);
  });
});

describe('managing participants', () => {
  async function warrior(guildId: string, discordUserId: string) {
    const member = await Member.create({
      guildId,
      discordUserId,
      discordName: 'Grommash',
      discordAvatar: null,
      rank: 'raider',
    });
    return Character.create({
      memberId: member.id,
      name: `Grom${discordUserId.slice(-2)}`,
      faction: 'horde',
      race: 'orc',
      characterClass: 'warrior',
      level: 60,
      professions: [],
      isMain: true,
    });
  }
  const raidWith = (characterId: string) => ({
    ...raid,
    startsAt: inDays(3),
    preConfirmed: [{ characterId, role: 'tank' }],
  });

  it('lets only the Guild Master pre-confirm, and tells the participants', async () => {
    const { app, agent, jobs, base, guild } = await setup();
    const character = await warrior(guild.id, '200000000000000010');
    await replaceGuildOfficers(guild.id, ['200000000000000002']);
    const officer = await loginAs(app, '200000000000000002');

    const refused = await officer.post(base).send(raidWith(character.id));
    const created = await agent.post(base).send(raidWith(character.id));

    expect(refused.status).toBe(403);
    expect(created.status).toBe(201);
    const [preConfirmed] = await SignUp.findAll({ where: { eventId: event(created).id } });
    expect(jobs.payloads('pre-confirmed')).toEqual([{ signUpId: preConfirmed!.id }]);
  });

  it('removes a participant and tells them who did it', async () => {
    const { agent, jobs, base, guild } = await setup();
    const character = await warrior(guild.id, '200000000000000010');
    const id = event(await agent.post(base).send(raidWith(character.id))).id;
    const [participant] = (await agent.get(`${base}/${id}/sign-ups`)).body as SignUpResponse[];

    const response = await agent.delete(`${base}/${id}/sign-ups/${participant!.id}`);

    expect(response.body).toEqual([]);
    expect(jobs.payloads('participant-removed')).toEqual([
      { memberId: character.memberId, eventId: id, byUserId: expect.any(String) as string },
    ]);
    expect(
      (
        await agent.post(`${base}/${id}/sign-ups/${participant!.id}/replace`).send({
          replacementId: participant!.id,
        })
      ).status,
    ).toBe(404);
  });
});
