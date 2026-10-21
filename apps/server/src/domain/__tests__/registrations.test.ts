import type { CharacterInput } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestGuild } from '../../../test/test-guild.js';
import { Character, Member, Registration, User, type Guild } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { DomainError } from '../errors.js';
import { approveRegistration, rejectRegistration, requestToJoin } from '../registrations.js';
import { addMember, chooseMainByName, removeMember } from '../roster.js';

const serverId = '300000000000000001';
const thrall = { discordUserId: '200000000000000002', discordName: 'Thrall', discordAvatar: null };

const shaman: CharacterInput = {
  name: 'Thrall',
  faction: 'horde',
  race: 'orc',
  class: 'shaman',
  level: 60,
  professions: [],
};
const priest: CharacterInput = { ...shaman, name: 'Zuljin', race: 'troll', class: 'priest' };

let sequelize: Sequelize;
let gm: User;
let guild: Guild;

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
});

async function request() {
  const outcome = await requestToJoin(serverId, thrall, 'es');
  if (outcome.result !== 'created') throw new Error(`Not created: ${outcome.result}`);
  return outcome.registration;
}

describe('requestToJoin', () => {
  it('creates a pending request with their Discord profile and language', async () => {
    const registration = await request();

    expect(registration).toMatchObject({
      guildId: guild.id,
      discordUserId: thrall.discordUserId,
      discordName: 'Thrall',
      locale: 'es',
      status: 'pending',
    });
  });

  it('needs a guild connected to the Discord server', async () => {
    await expect(requestToJoin('399999999999999999', thrall, null)).resolves.toEqual({
      result: 'no_guild',
    });
  });

  it('refuses a second pending request', async () => {
    await request();

    const outcome = await requestToJoin(serverId, thrall, null);

    expect(outcome.result).toBe('already_pending');
  });

  it("refuses someone who's on the roster, but not someone who was removed", async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm);
    expect((await requestToJoin(serverId, thrall, null)).result).toBe('on_roster');

    await removeMember(member, guild);

    expect((await requestToJoin(serverId, thrall, null)).result).toBe('created');
  });
});

describe('approveRegistration', () => {
  it('adds them to the roster as a Member, without characters', async () => {
    const registration = await request();

    const { member, restored } = await approveRegistration(guild, registration.id, gm);

    expect(restored).toBe(false);
    expect(member).toMatchObject({ rank: 'member', locale: 'es', discordName: 'Thrall' });
    expect(await Character.count({ where: { memberId: member.id } })).toBe(0);
    await registration.reload();
    expect(registration).toMatchObject({ status: 'approved', reviewedByUserId: gm.id });
  });

  it('restores a removed member with their rank and characters', async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm, [shaman, priest]);
    await removeMember(member, guild);
    const registration = await request();

    const approved = await approveRegistration(guild, registration.id, gm);

    expect(approved.restored).toBe(true);
    expect(approved.member.id).toBe(member.id);
    expect(approved.member.rank).toBe('raider');
    expect(await Character.count({ where: { memberId: member.id, removedAt: null } })).toBe(2);
  });

  it('only closes the request of someone added by hand meanwhile', async () => {
    const registration = await request();
    const { member } = await addMember(guild, thrall, 'raider', gm);

    const approved = await approveRegistration(guild, registration.id, gm);

    expect(approved.member.id).toBe(member.id);
    expect(approved.restored).toBe(false);
    expect(await Member.count()).toBe(2); // The Guild Master and Thrall.
  });

  it('refuses a request that was already reviewed', async () => {
    const registration = await request();
    await rejectRegistration(guild, registration.id, gm);

    await expect(approveRegistration(guild, registration.id, gm)).rejects.toEqual(
      new DomainError({ code: 'REGISTRATION_NOT_PENDING' }),
    );
  });

  it("doesn't find another guild's request", async () => {
    const registration = await request();
    const otherGm = await User.create({
      discordId: '200000000000000009',
      name: 'Vol',
      avatar: null,
    });
    const other = await createTestGuild(otherGm, { serverId: '300000000000000002' });

    await expect(approveRegistration(other, registration.id, otherGm)).rejects.toEqual(
      new DomainError({ code: 'NOT_FOUND' }),
    );
  });
});

describe('rejectRegistration', () => {
  it('records who rejected it, and lets them ask again', async () => {
    const registration = await request();

    const rejected = await rejectRegistration(guild, registration.id, gm);

    expect(rejected).toMatchObject({ status: 'rejected', reviewedByUserId: gm.id });
    expect(await Registration.count({ where: { status: 'pending' } })).toBe(0);
    await expect(request()).resolves.toBeDefined();
  });
});

describe('chooseMainByName', () => {
  it('makes one of their characters the main, ignoring case', async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm, [shaman, priest]);

    await expect(chooseMainByName(serverId, thrall.discordUserId, ' zuljin ')).resolves.toEqual({
      result: 'changed',
      name: 'Zuljin',
    });

    const main = await Character.findOne({ where: { memberId: member.id, isMain: true } });
    expect(main!.name).toBe('Zuljin');
  });

  it('says when the character is already the main', async () => {
    await addMember(guild, thrall, 'raider', gm, [shaman]);

    const outcome = await chooseMainByName(serverId, thrall.discordUserId, 'Thrall');

    expect(outcome).toEqual({ result: 'already_main', name: 'Thrall' });
  });

  it("refuses someone else's character, and someone not on the roster", async () => {
    const jaina = {
      discordUserId: '200000000000000003',
      discordName: 'Jaina',
      discordAvatar: null,
    };
    await addMember(guild, jaina, 'raider', gm, [shaman]);

    expect((await chooseMainByName(serverId, thrall.discordUserId, 'Thrall')).result).toBe(
      'not_on_roster',
    );
    await addMember(guild, thrall, 'raider', gm, [priest]);
    expect((await chooseMainByName(serverId, thrall.discordUserId, 'Thrall')).result).toBe(
      'not_your_character',
    );
  });
});
