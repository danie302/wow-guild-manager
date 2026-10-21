import type { Sequelize } from 'sequelize';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loginAs, testApp } from '../../../test/api-app.js';
import {
  ADMINISTRATOR,
  FakeDiscordDirectory,
  MANAGE_GUILD,
  role,
  server,
} from '../../../test/fake-discord-directory.js';
import { Guild, User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';

/** The response fields these tests read. */
interface Body {
  id: number;
  servers: unknown;
  guilds: unknown;
  officerRole: unknown;
  error: { issues: unknown };
}

const body = (response: request.Response) => response.body as Body;

const gm = '200000000000000001';
const other = '200000000000000002';

const ashen = '300000000000000001';
const ember = '300000000000000002';
const notManaged = '300000000000000003';

const officers = '400000000000000001';
const managers = '400000000000000002';
const botRole = '400000000000000003';
const emberOfficers = '400000000000000011';

function discord() {
  const directory = new FakeDiscordDirectory()
    .addServer(
      server(ashen, 'Ashen Vanguard', {
        icon: 'abc',
        roles: [
          role(officers, 'Officers', { color: 0xc8a14a, position: 2 }),
          role(managers, 'Managers', { permissions: MANAGE_GUILD, position: 3 }),
          role(botRole, 'Guild Manager', { managed: true, position: 4 }),
        ],
      }),
    )
    .addServer(
      server(ember, 'Emberwatch', {
        roles: [role(emberOfficers, 'Officers', { permissions: ADMINISTRATOR })],
      }),
    )
    .addServer(server(notManaged, 'Somebody Else'))
    .addMember(ashen, gm, [managers])
    .addMember(ember, gm, [emberOfficers])
    .addMember(notManaged, gm)
    .addMember(ashen, other, [officers]);
  return { directory, botInviteUrl: 'https://discord.test/invite' };
}

const newGuild = {
  name: '  Ashen Vanguard ',
  faction: 'alliance',
  discordServerId: ashen,
  officerRoleId: officers,
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

describe('GET /api/discord/servers', () => {
  it('lists the servers where the bot is and the user can manage the server', async () => {
    const app = testApp(discord());
    const agent = await loginAs(app, gm);

    const response = await agent.get('/api/discord/servers');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      botInviteUrl: 'https://discord.test/invite',
      servers: [
        {
          id: ashen,
          name: 'Ashen Vanguard',
          iconUrl: `https://cdn.discordapp.com/icons/${ashen}/abc.png?size=64`,
          available: true,
        },
        { id: ember, name: 'Emberwatch', iconUrl: null, available: true },
      ],
    });
  });

  it('marks servers already connected to a guild as not available', async () => {
    const app = testApp(discord());
    await (await loginAs(app, gm)).post('/api/guilds').send(newGuild).expect(201);

    const response = await (await loginAs(app, other)).get('/api/discord/servers');

    // `other` has no Manage Server in Ashen Vanguard, so they don't see it at all; the GM does.
    expect(body(response).servers).toEqual([]);
    const forGm = await (await loginAs(app, gm)).get('/api/discord/servers');
    expect(body(forGm).servers).toEqual([
      expect.objectContaining({ id: ashen, available: false }),
      expect.objectContaining({ id: ember, available: true }),
    ]);
  });

  it('answers 503 DISCORD_NOT_CONFIGURED without a bot token', async () => {
    const agent = await loginAs(testApp(null), gm);

    const response = await agent.get('/api/discord/servers');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: { code: 'DISCORD_NOT_CONFIGURED' } });
  });

  it('answers 503 DISCORD_UNAVAILABLE when Discord is down', async () => {
    const access = discord();
    access.directory.down = true;
    const agent = await loginAs(testApp(access), gm);

    const response = await agent.get('/api/discord/servers');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: { code: 'DISCORD_UNAVAILABLE' } });
  });

  it('needs a login', async () => {
    const response = await request(testApp(discord())).get('/api/discord/servers');

    expect(response.status).toBe(401);
  });
});

describe('GET /api/discord/servers/:serverId/roles', () => {
  it("lists the roles that can grant Officer, without @everyone or the bot's role", async () => {
    const agent = await loginAs(testApp(discord()), gm);

    const response = await agent.get(`/api/discord/servers/${ashen}/roles`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      roles: [
        { id: managers, name: 'Managers', color: null },
        { id: officers, name: 'Officers', color: '#c8a14a' },
      ],
    });
  });

  it("answers 403 for a server the user can't manage", async () => {
    const agent = await loginAs(testApp(discord()), gm);

    const response = await agent.get(`/api/discord/servers/${notManaged}/roles`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: { code: 'FORBIDDEN' } });
  });
});

describe('POST /api/guilds', () => {
  it('creates the guild with the user as its Guild Master', async () => {
    const agent = await loginAs(testApp(discord()), gm);

    const response = await agent.post('/api/guilds').send(newGuild);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number) as unknown,
      name: 'Ashen Vanguard',
      faction: 'alliance',
      discordServer: {
        id: ashen,
        name: 'Ashen Vanguard',
        iconUrl: `https://cdn.discordapp.com/icons/${ashen}/abc.png?size=64`,
      },
      officerRole: { id: officers, name: 'Officers' },
    });
    const me = await agent.get('/api/me');
    expect(body(me).guilds).toEqual([
      { id: body(response).id, name: 'Ashen Vanguard', access: 'guild_master' },
    ]);
  });

  it('answers 409 ALREADY_LEADS_GUILD to a user who already leads a guild', async () => {
    const agent = await loginAs(testApp(discord()), gm);
    await agent.post('/api/guilds').send(newGuild).expect(201);

    const response = await agent
      .post('/api/guilds')
      .send({ ...newGuild, discordServerId: ember, officerRoleId: emberOfficers });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: 'ALREADY_LEADS_GUILD' } });
    expect(await Guild.count()).toBe(1);
  });

  it('creates only one guild when the same user sends two requests at once', async () => {
    const agent = await loginAs(testApp(discord()), gm);

    const responses = await Promise.all([
      agent.post('/api/guilds').send(newGuild),
      agent
        .post('/api/guilds')
        .send({ ...newGuild, discordServerId: ember, officerRoleId: emberOfficers }),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Guild.count()).toBe(1);
  });

  it('answers 409 DISCORD_SERVER_TAKEN for a server connected to another guild', async () => {
    const access = discord();
    access.directory.addMember(ashen, other, [managers]);
    const app = testApp(access);
    await (await loginAs(app, gm)).post('/api/guilds').send(newGuild).expect(201);

    const response = await (await loginAs(app, other)).post('/api/guilds').send(newGuild);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: 'DISCORD_SERVER_TAKEN' } });
  });

  it.each([
    ['the bot is not in', '300000000000000099'],
    ["the user can't manage", notManaged],
  ])('rejects a server %s', async (_case, discordServerId) => {
    const agent = await loginAs(testApp(discord()), gm);

    const response = await agent.post('/api/guilds').send({ ...newGuild, discordServerId });

    expect(response.status).toBe(400);
    expect(body(response).error.issues).toEqual([
      { field: 'discordServerId', code: 'DISCORD_SERVER_NOT_MANAGEABLE' },
    ]);
  });

  it.each([
    ['from another server', emberOfficers],
    ['managed by an integration', botRole],
    ['@everyone', ashen],
  ])('rejects an Officer role %s', async (_case, officerRoleId) => {
    const agent = await loginAs(testApp(discord()), gm);

    const response = await agent.post('/api/guilds').send({ ...newGuild, officerRoleId });

    expect(response.status).toBe(400);
    expect(body(response).error.issues).toEqual([
      { field: 'officerRoleId', code: 'OFFICER_ROLE_NOT_FOUND' },
    ]);
  });

  it.each([
    ['an empty name', '  ', 'REQUIRED'],
    ['a name over 50 characters', 'A'.repeat(51), 'TOO_LONG'],
    ['an offensive name', 'Los Pendejos', 'NAME_NOT_ALLOWED'],
  ])('rejects %s', async (_case, name, code) => {
    const agent = await loginAs(testApp(discord()), gm);

    const response = await agent.post('/api/guilds').send({ ...newGuild, name });

    expect(response.status).toBe(400);
    expect(body(response).error.issues).toEqual([expect.objectContaining({ field: 'name', code })]);
  });
});

describe('GET /api/guilds/:guildId', () => {
  it('still shows the guild when Discord is down, without the names', async () => {
    const access = discord();
    const agent = await loginAs(testApp(access), gm);
    const created = await agent.post('/api/guilds').send(newGuild).expect(201);
    access.directory.down = true;

    const response = await agent.get(`/api/guilds/${body(created).id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      discordServer: { id: ashen, name: null, iconUrl: null },
      officerRole: { id: officers, name: null },
    });
  });

  it('answers 403 to someone who is not its Guild Master, and 404 for no guild', async () => {
    const app = testApp(discord());
    const created = await (await loginAs(app, gm)).post('/api/guilds').send(newGuild);
    const agent = await loginAs(app, other);

    expect((await agent.get(`/api/guilds/${body(created).id}`)).status).toBe(403);
    expect((await agent.get('/api/guilds/999999')).status).toBe(404);
    expect((await agent.get('/api/guilds/abc')).status).toBe(404);
  });
});

describe('PUT /api/guilds/:guildId/discord', () => {
  it('lets the Guild Master connect another server and Officer role', async () => {
    const agent = await loginAs(testApp(discord()), gm);
    const created = await agent.post('/api/guilds').send(newGuild);

    const response = await agent
      .put(`/api/guilds/${body(created).id}/discord`)
      .send({ discordServerId: ember, officerRoleId: emberOfficers });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      discordServer: { id: ember, name: 'Emberwatch' },
      officerRole: { id: emberOfficers, name: 'Officers' },
    });
  });

  it('lets the Guild Master keep the server and change only the role', async () => {
    const agent = await loginAs(testApp(discord()), gm);
    const created = await agent.post('/api/guilds').send(newGuild);

    const response = await agent
      .put(`/api/guilds/${body(created).id}/discord`)
      .send({ discordServerId: ashen, officerRoleId: managers });

    expect(response.status).toBe(200);
    expect(body(response).officerRole).toEqual({ id: managers, name: 'Managers' });
  });

  it('answers 403 to anyone else, even someone who manages the server', async () => {
    const access = discord();
    access.directory.addMember(ashen, other, [managers]);
    const app = testApp(access);
    const created = await (await loginAs(app, gm)).post('/api/guilds').send(newGuild);

    const response = await (
      await loginAs(app, other)
    )
      .put(`/api/guilds/${body(created).id}/discord`)
      .send({ discordServerId: ashen, officerRoleId: managers });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: { code: 'FORBIDDEN' } });
  });
});
