import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestGuild } from '../../../test/test-guild.js';
import { User, type Guild, type Member } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { markLeftDiscord, markRejoinedDiscord, syncPresence } from '../presence.js';
import { requestToJoin } from '../registrations.js';
import { addMember, removeMember } from '../roster.js';

const serverId = '300000000000000001';
const thrall = { discordUserId: '200000000000000002', discordName: 'Thrall', discordAvatar: null };
const jaina = { discordUserId: '200000000000000003', discordName: 'Jaina', discordAvatar: null };

let sequelize: Sequelize;
let gm: User;
let guild: Guild;
let member: Member;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
  gm = await User.create({ discordId: '200000000000000001', name: 'Garrosh', avatar: null });
  guild = await createTestGuild(gm, { serverId });
  ({ member } = await addMember(guild, thrall, 'raider', gm));
});

describe('leaving and rejoining the Discord server', () => {
  it('flags a member with the date, keeps them on the roster, and clears it when they rejoin', async () => {
    const at = new Date('2026-10-21T10:00:00Z');

    await markLeftDiscord(serverId, thrall.discordUserId, at);

    await member.reload();
    expect(member.leftDiscordAt).toEqual(at);
    expect(member.removedAt).toBeNull();

    await markRejoinedDiscord(serverId, thrall.discordUserId);

    await member.reload();
    expect(member.leftDiscordAt).toBeNull();
  });

  it('keeps the first date when a leave is seen twice', async () => {
    await markLeftDiscord(serverId, thrall.discordUserId, new Date('2026-10-20T10:00:00Z'));
    await markLeftDiscord(serverId, thrall.discordUserId, new Date('2026-10-21T10:00:00Z'));

    await member.reload();
    expect(member.leftDiscordAt).toEqual(new Date('2026-10-20T10:00:00Z'));
  });

  it('flags a pending request to join, which stays pending', async () => {
    const outcome = await requestToJoin(serverId, jaina, null);
    if (outcome.result !== 'created') throw new Error(outcome.result);

    await markLeftDiscord(serverId, jaina.discordUserId);

    await outcome.registration.reload();
    expect(outcome.registration.leftDiscordAt).toBeInstanceOf(Date);
    expect(outcome.registration.status).toBe('pending');
  });

  it('flags removed members too, so a restored member shows it', async () => {
    await removeMember(member, guild);

    await markLeftDiscord(serverId, thrall.discordUserId);

    await member.reload();
    expect(member.leftDiscordAt).toBeInstanceOf(Date);
  });
});

describe('syncPresence', () => {
  it('flags everyone when the server has no members left', async () => {
    await syncPresence(guild.id, []);

    await member.reload();
    expect(member.leftDiscordAt).toBeInstanceOf(Date);
  });
});
