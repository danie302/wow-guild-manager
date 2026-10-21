import { Collection, type Client } from 'discord.js';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Guild, GuildOfficer, User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { replaceGuildOfficers } from '../../domain/officers.js';
import { createTestLogger } from '../../test-logger.js';
import { resyncAllOfficers } from '../officer-sync.js';

const officerRole = '400000000000000001';

/** A Discord server as the bot's cache has it, with members and their role IDs. */
function fakeServer(id: string, members: Record<string, string[]>) {
  const collection = new Collection(
    Object.entries(members).map(([memberId, roleIds]) => [
      memberId,
      { id: memberId, roles: { cache: new Collection(roleIds.map((roleId) => [roleId, {}])) } },
    ]),
  );
  return { id, members: { fetch: () => Promise.resolve(collection) } };
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

async function createGuild(name: string, discordServerId: string) {
  const gm = await User.create({
    discordId: `2000000000000000${name.length}0`,
    name,
    avatar: null,
  });
  return Guild.create({
    name,
    faction: 'horde',
    discordServerId,
    officerRoleId: officerRole,
    guildMasterUserId: gm.id,
  });
}

describe('resyncAllOfficers', () => {
  it("replaces each guild's Officers with the members who have the role now", async () => {
    const ashen = await createGuild('Ashen', '300000000000000001');
    const ember = await createGuild('Emberwatch', '300000000000000002');
    await replaceGuildOfficers(ashen.id, ['200000000000000003']);
    await replaceGuildOfficers(ember.id, ['200000000000000004']);
    const servers = new Collection([
      [
        '300000000000000001',
        fakeServer('300000000000000001', {
          '200000000000000001': [officerRole],
          '200000000000000002': [],
        }),
      ],
    ]);
    const client = { guilds: { cache: servers } } as unknown as Client;

    await resyncAllOfficers(client, createTestLogger().logger);

    const rows = await GuildOfficer.findAll();
    expect(rows.map((row) => [row.guildId, row.discordUserId])).toEqual([
      [ashen.id, '200000000000000001'],
    ]);
  });
});
