import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Guild, GuildOfficer, User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import {
  removeServer,
  removeServerMember,
  removeServerRole,
  replaceGuildOfficers,
  updateServerMember,
} from '../officers.js';

const server = '300000000000000001';
const officerRole = '400000000000000001';
const raiderRole = '400000000000000002';
const thrall = '200000000000000001';
const jaina = '200000000000000002';

let sequelize: Sequelize;
let guild: Guild;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
  const gm = await User.create({ discordId: '200000000000000099', name: 'Anduin', avatar: null });
  guild = await Guild.create({
    name: 'Ashen Vanguard',
    faction: 'alliance',
    discordServerId: server,
    officerRoleId: officerRole,
    guildMasterUserId: gm.id,
  });
});

async function officers(): Promise<string[]> {
  const rows = await GuildOfficer.findAll({ where: { guildId: guild.id } });
  return rows.map((row) => row.discordUserId).sort();
}

describe('Officers', () => {
  it('replaces the whole list', async () => {
    await replaceGuildOfficers(guild.id, [thrall]);
    await replaceGuildOfficers(guild.id, [jaina]);

    expect(await officers()).toEqual([jaina]);
  });

  it('adds a member who gets the Officer role, and removes them when they lose it', async () => {
    await updateServerMember(server, thrall, [raiderRole, officerRole]);
    await updateServerMember(server, thrall, [raiderRole, officerRole]);
    expect(await officers()).toEqual([thrall]);

    await updateServerMember(server, thrall, [raiderRole]);
    expect(await officers()).toEqual([]);
  });

  it('removes an Officer who leaves the server', async () => {
    await replaceGuildOfficers(guild.id, [thrall, jaina]);

    await removeServerMember(server, thrall);

    expect(await officers()).toEqual([jaina]);
  });

  it('removes every Officer when the Officer role is deleted, but not for other roles', async () => {
    await replaceGuildOfficers(guild.id, [thrall]);

    await removeServerRole(server, raiderRole);
    expect(await officers()).toEqual([thrall]);
    await removeServerRole(server, officerRole);
    expect(await officers()).toEqual([]);
  });

  it('removes every Officer when the bot leaves the server', async () => {
    await replaceGuildOfficers(guild.id, [thrall]);

    await removeServer(server);

    expect(await officers()).toEqual([]);
  });

  it('ignores servers that no guild is connected to', async () => {
    await updateServerMember('300000000000000009', thrall, [officerRole]);

    expect(await GuildOfficer.count()).toBe(0);
  });
});
