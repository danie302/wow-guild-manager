import type { MemberDetailResponse, RosterMember } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loginAs, testApp } from '../../../test/api-app.js';
import {
  FakeDiscordDirectory,
  MANAGE_GUILD,
  role,
  server,
} from '../../../test/fake-discord-directory.js';
import { User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';

const gm = '200000000000000001';
const officer = '200000000000000002';
const thrall = '200000000000000003';
const jaina = '200000000000000004';
const serverId = '300000000000000001';
const officers = '400000000000000001';
const admins = '400000000000000002';

const shaman = {
  name: 'Thrall',
  faction: 'horde',
  race: 'orc',
  class: 'shaman',
  level: 60,
  professions: ['alchemy', 'cooking'],
};

interface Body {
  error: { code: string; issues: unknown };
}
const roster = (response: request.Response) => response.body as RosterMember[];
const detail = (response: request.Response) => response.body as MemberDetailResponse;
const added = (response: request.Response) =>
  response.body as { member: MemberDetailResponse; restored: boolean };

/** A Horde guild led by `gm`, with `officer` holding the Officer role, and both on Discord. */
async function setup() {
  const directory = new FakeDiscordDirectory()
    .addServer(
      server(serverId, 'Orgrimmar', {
        roles: [role(officers, 'Officers'), role(admins, 'Admins', { permissions: MANAGE_GUILD })],
      }),
    )
    .addMember(serverId, gm, [admins], 'Garrosh')
    .addMember(serverId, officer, [officers], 'Saurfang')
    .addMember(serverId, thrall, [], 'Thrall')
    .addMember(serverId, jaina, [], 'Jaina');
  const app = testApp({ directory, botInviteUrl: 'https://discord.test/invite' });
  const gmAgent = await loginAs(app, gm);
  const created = await gmAgent.post('/api/guilds').send({
    name: 'Horde',
    faction: 'horde',
    discordServerId: serverId,
    officerRoleId: officers,
  });
  const guildId = (created.body as { id: string }).id;
  const officerAgent = await loginAs(app, officer);
  const base = `/api/guilds/${guildId}/members`;
  // The Officer joins the roster as a Raider; their rank shows as Officer.
  const saurfang = added(
    await gmAgent.post(base).send({
      discordUserId: officer,
      rank: 'raider',
      characters: [{ ...shaman, name: 'Saurfang', class: 'warrior' }],
    }),
  ).member;
  return { app, directory, gmAgent, officerAgent, base, guildId, saurfang };
}

async function addThrall(agent: ReturnType<typeof request.agent>, base: string) {
  return added(
    await agent.post(base).send({
      discordUserId: thrall,
      rank: 'raider',
      characters: [shaman, { ...shaman, name: 'Zuljin', race: 'troll', class: 'priest' }],
    }),
  ).member;
}

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

describe('the roster', () => {
  it('lists every member with their rank and characters, main first', async () => {
    const { officerAgent, base } = await setup();
    await addThrall(officerAgent, base);

    const members = roster(await officerAgent.get(base));

    // Sorted by name. The Guild Master joined with their app account's name ("User 0001").
    expect(members.map((member) => [member.discordName, member.rank])).toEqual([
      ['Saurfang', 'officer'],
      ['Thrall', 'raider'],
      ['User 0001', 'guild_master'],
    ]);
    expect(members[1]!.characters.map((character) => [character.name, character.isMain])).toEqual([
      ['Thrall', true],
      ['Zuljin', false],
    ]);
  });

  it('answers 403 to someone without access', async () => {
    const { app, base } = await setup();

    const stranger = await loginAs(app, jaina);

    expect((await stranger.get(base)).status).toBe(403);
  });
});

describe('adding a member', () => {
  it("takes the Discord user's name from the server, and records who added them", async () => {
    const { officerAgent, base } = await setup();

    const member = await addThrall(officerAgent, base);

    expect(member).toMatchObject({ discordName: 'Thrall', rank: 'raider' });
    expect(member.rankHistory).toEqual([
      expect.objectContaining({ fromRank: null, toRank: 'raider', changedBy: 'User 0002' }),
    ]);
  });

  it('adds a member without characters', async () => {
    const { gmAgent, base } = await setup();

    const response = await gmAgent.post(base).send({ discordUserId: thrall, rank: 'member' });

    expect(response.status).toBe(201);
    expect(added(response).member).toMatchObject({ discordName: 'Thrall', characters: [] });
    expect(
      roster(await gmAgent.get(base)).find((m) => m.discordName === 'Thrall')?.characters,
    ).toEqual([]);
  });

  it('rejects an invalid character with the field that is wrong', async () => {
    const { gmAgent, base } = await setup();

    const response = await gmAgent.post(base).send({
      discordUserId: thrall,
      rank: 'raider',
      characters: [{ ...shaman, class: 'mage', race: 'tauren' }],
    });

    expect(response.status).toBe(400);
    expect((response.body as Body).error.issues).toEqual([
      { field: 'characters.0.class', code: 'CLASS_NOT_FOR_RACE' },
    ]);
  });

  it("rejects someone who isn't on the Discord server", async () => {
    const { gmAgent, base } = await setup();

    const response = await gmAgent
      .post(base)
      .send({ discordUserId: '200000000000000099', rank: 'raider', characters: [shaman] });

    expect((response.body as Body).error.issues).toEqual([
      { field: 'discordUserId', code: 'DISCORD_USER_NOT_IN_SERVER' },
    ]);
  });

  it('answers 409 for someone already on the roster, and restores a removed one', async () => {
    const { gmAgent, base } = await setup();
    const member = await addThrall(gmAgent, base);

    const again = await gmAgent
      .post(base)
      .send({ discordUserId: thrall, rank: 'member', characters: [shaman] });
    await gmAgent.delete(`${base}/${member.id}`).expect(204);
    const restored = await gmAgent.post(base).send({
      discordUserId: thrall,
      rank: 'member',
      characters: [{ ...shaman, name: 'Rexxar', race: 'orc', class: 'hunter' }],
    });

    expect(again.status).toBe(409);
    expect(restored.status).toBe(200);
    expect(added(restored)).toMatchObject({
      restored: true,
      member: { id: member.id, baseRank: 'raider' },
    });
    expect(added(restored).member.characters.map((character) => character.name)).toEqual([
      'Thrall',
      'Rexxar',
      'Zuljin',
    ]);
  });
});

describe('managing a member', () => {
  it('changes the rank between Raider and Member, with history', async () => {
    const { officerAgent, base } = await setup();
    const member = await addThrall(officerAgent, base);

    const response = await officerAgent.patch(`${base}/${member.id}`).send({ rank: 'member' });

    expect(detail(response).rank).toBe('member');
    expect(detail(response).rankHistory[0]).toMatchObject({
      fromRank: 'raider',
      toRank: 'member',
      changedBy: 'User 0002',
      source: 'app',
    });
  });

  it("doesn't let an Officer change the rank of the Guild Master or another Officer", async () => {
    const { gmAgent, officerAgent, base, saurfang } = await setup();
    const garrosh = roster(await gmAgent.get(base)).find(
      (member) => member.rank === 'guild_master',
    )!;

    for (const target of [garrosh, saurfang]) {
      const response = await officerAgent.patch(`${base}/${target.id}`).send({ rank: 'member' });
      expect(response.status).toBe(403);
    }
    expect((await gmAgent.patch(`${base}/${saurfang.id}`).send({ rank: 'member' })).status).toBe(
      200,
    );
  });

  it('removes Raiders and Members, but an Officer can remove no one else', async () => {
    const { gmAgent, officerAgent, base, saurfang } = await setup();
    const member = await addThrall(officerAgent, base);
    const garrosh = roster(await gmAgent.get(base)).find((m) => m.rank === 'guild_master')!;

    expect((await officerAgent.delete(`${base}/${saurfang.id}`)).status).toBe(403);
    expect((await officerAgent.delete(`${base}/${garrosh.id}`)).status).toBe(403);
    expect((await officerAgent.delete(`${base}/${member.id}`)).status).toBe(204);
    expect(roster(await gmAgent.get(base)).map((m) => m.discordName)).toEqual([
      'Saurfang',
      'User 0001',
    ]);
    expect((await gmAgent.get(`${base}/${member.id}`)).status).toBe(404);
  });

  it("can't remove the Guild Master, even by themselves", async () => {
    const { gmAgent, base } = await setup();
    const garrosh = roster(await gmAgent.get(base)).find((m) => m.rank === 'guild_master')!;

    const response = await gmAgent.delete(`${base}/${garrosh.id}`);

    expect(response.status).toBe(409);
    expect((response.body as Body).error.code).toBe('GUILD_MASTER_CANNOT_BE_REMOVED');
  });

  it('adds a character, and changes the main', async () => {
    const { officerAgent, base } = await setup();
    const member = await addThrall(officerAgent, base);
    const zuljin = member.characters.find((character) => character.name === 'Zuljin')!;

    const withRexxar = await officerAgent
      .post(`${base}/${member.id}/characters`)
      .send({ ...shaman, name: 'Rexxar', class: 'hunter' });
    const response = await officerAgent
      .put(`${base}/${member.id}/main`)
      .send({ characterId: zuljin.id });

    expect(withRexxar.status).toBe(201);
    expect(
      detail(response).characters.map((character) => [character.name, character.isMain]),
    ).toEqual([
      ['Zuljin', true],
      ['Rexxar', false],
      ['Thrall', false],
    ]);
  });

  it('keeps officer notes with their author, newest first', async () => {
    const { gmAgent, officerAgent, base } = await setup();
    const member = await addThrall(officerAgent, base);

    await gmAgent.post(`${base}/${member.id}/notes`).send({ text: 'Trial until June.' });
    const response = await officerAgent
      .post(`${base}/${member.id}/notes`)
      .send({ text: '  Passed the trial. ' });

    expect(detail(response).officerNotes.map((note) => [note.text, note.author])).toEqual([
      ['Passed the trial.', 'User 0002'],
      ['Trial until June.', 'User 0001'],
    ]);
    expect((await officerAgent.post(`${base}/${member.id}/notes`).send({ text: ' ' })).status).toBe(
      400,
    );
  });
});

describe('editing and removing characters', () => {
  it('edits a character and answers with the member page', async () => {
    const { officerAgent, base } = await setup();
    const member = await addThrall(officerAgent, base);
    const zuljin = member.characters.find((character) => character.name === 'Zuljin')!;

    const response = await officerAgent
      .put(`${base}/${member.id}/characters/${zuljin.id}`)
      .send({ ...shaman, name: 'Zuljin', race: 'troll', class: 'priest', level: 41 });

    expect(response.status).toBe(200);
    expect(detail(response).characters.find((c) => c.id === zuljin.id)).toMatchObject({
      level: 41,
      class: 'priest',
    });
  });

  it('answers with the issues of an invalid edit', async () => {
    const { officerAgent, base } = await setup();
    const member = await addThrall(officerAgent, base);
    const zuljin = member.characters.find((character) => character.name === 'Zuljin')!;

    const response = await officerAgent
      .put(`${base}/${member.id}/characters/${zuljin.id}`)
      .send({ ...shaman, name: 'Saurfang', race: 'troll', class: 'priest' });

    expect(response.status).toBe(400);
    expect((response.body as Body).error.issues).toEqual([
      { field: 'name', code: 'CHARACTER_NAME_TAKEN' },
    ]);
  });

  it('removes a character, and the next one becomes the main', async () => {
    const { officerAgent, base } = await setup();
    const member = await addThrall(officerAgent, base);
    const main = member.characters.find((character) => character.isMain)!;

    const response = await officerAgent.delete(`${base}/${member.id}/characters/${main.id}`);
    const again = await officerAgent.delete(`${base}/${member.id}/characters/${main.id}`);

    expect(response.status).toBe(200);
    expect(detail(response).characters.map((c) => [c.name, c.isMain])).toEqual([['Zuljin', true]]);
    expect(again.status).toBe(404);
  });
});

describe('searching the Discord server', () => {
  it('finds server members by name, marking who is already on the roster', async () => {
    const { gmAgent, guildId } = await setup();

    const response = await gmAgent.get(`/api/guilds/${guildId}/discord-members?query=sa`);
    const short = await gmAgent.get(`/api/guilds/${guildId}/discord-members?query=s`);

    expect(response.body).toEqual([
      expect.objectContaining({ id: officer, name: 'Saurfang', onRoster: true }),
    ]);
    expect(short.body).toEqual([]);
  });
});
