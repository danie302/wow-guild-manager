import type { ApproveRegistrationInput, CharacterInput } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeCharacterLookup } from '../../../test/fake-character-lookup.js';
import { createTestGuild } from '../../../test/test-guild.js';
import {
  Character,
  CharacterRegistration,
  Member,
  type Guild,
  User,
} from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { DomainError, DomainValidationError } from '../errors.js';
import {
  approveRegistration,
  lookUpRegistration,
  registerCharacter,
  rejectRegistration,
} from '../registrations.js';
import { addMember, removeMember } from '../roster.js';

const serverId = '300000000000000001';
const otherServerId = '300000000000000002';
const thrall = { discordUserId: '200000000000000002', discordName: 'Thrall', discordAvatar: null };

const shaman: CharacterInput = {
  name: 'Thrall',
  faction: 'horde',
  race: 'orc',
  class: 'shaman',
  level: 60,
  professions: [],
};
const byHand: ApproveRegistrationInput = {
  race: 'orc',
  class: 'shaman',
  level: 58,
  professions: ['alchemy'],
};

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

async function register(name = 'Thrall') {
  const outcome = await registerCharacter(serverId, thrall, name, 'es');
  if (outcome.result !== 'created') throw new Error(`Not created: ${outcome.result}`);
  return outcome.registration;
}

describe('registerCharacter', () => {
  it('creates a pending registration waiting for its lookup', async () => {
    const registration = await register();

    expect(registration).toMatchObject({
      guildId: guild.id,
      name: 'Thrall',
      discordUserId: thrall.discordUserId,
      locale: 'es',
      status: 'pending',
      lookup: 'pending',
    });
  });

  it('needs a guild connected to the Discord server', async () => {
    await expect(registerCharacter('399999999999999999', thrall, 'Thrall', null)).resolves.toEqual({
      result: 'no_guild',
    });
  });

  it('refuses a name already pending in the guild, ignoring case', async () => {
    await register();

    await expect(registerCharacter(serverId, thrall, 'THRALL', null)).resolves.toEqual({
      result: 'already_pending',
    });
  });

  it("refuses a character on this guild's roster", async () => {
    await addMember(guild, thrall, 'raider', gm, [shaman]);

    const outcome = await registerCharacter(serverId, thrall, 'thrall', null);

    expect(outcome.result).toBe('on_roster');
  });

  it('refuses a character in another guild', async () => {
    const otherGm = await User.create({
      discordId: '200000000000000009',
      name: 'Vol',
      avatar: null,
    });
    const other = await createTestGuild(otherGm, { serverId: otherServerId });
    await addMember(other, thrall, 'raider', otherGm, [shaman]);

    await expect(registerCharacter(serverId, thrall, 'Thrall', null)).resolves.toEqual({
      result: 'in_another_guild',
    });
  });
});

describe('lookUpRegistration', () => {
  it('marks the lookup unavailable while there is no Battle.net client', async () => {
    const registration = await register();
    const lookup = new FakeCharacterLookup();
    lookup.down = true;

    await expect(lookUpRegistration(registration.id, lookup)).resolves.toBeNull();

    await registration.reload();
    expect(registration.lookup).toBe('unavailable');
    expect(registration.status).toBe('pending');
  });

  it('flags a character the lookup cannot find', async () => {
    const registration = await register();
    const lookup = new FakeCharacterLookup();

    await lookUpRegistration(registration.id, lookup);

    await registration.reload();
    expect(registration).toMatchObject({ lookup: 'not_found', lookedUpAt: lookup.fetchedAt });
  });

  it('fills in the race, class, and level of a found character', async () => {
    const registration = await register();
    const lookup = new FakeCharacterLookup().addCharacter({
      name: 'Thrall',
      faction: 'horde',
      race: 'orc',
      characterClass: 'shaman',
      level: 60,
    });

    await expect(lookUpRegistration(registration.id, lookup)).resolves.toBeNull();

    await registration.reload();
    expect(registration).toMatchObject({
      lookup: 'found',
      faction: 'horde',
      race: 'orc',
      characterClass: 'shaman',
      level: 60,
      status: 'pending',
    });
  });

  it('rejects a character of the wrong faction', async () => {
    const registration = await register();
    const lookup = new FakeCharacterLookup().addCharacter({
      name: 'Thrall',
      faction: 'alliance',
      race: 'human',
      characterClass: 'mage',
      level: 60,
    });

    const rejected = await lookUpRegistration(registration.id, lookup);

    expect(rejected).toMatchObject({ status: 'rejected', rejectionReason: 'wrong_faction' });
    expect(rejected!.reviewedByUserId).toBeNull();
  });

  it('does nothing for a registration that was reviewed meanwhile', async () => {
    const registration = await register();
    await rejectRegistration(guild, registration.id, gm);
    const lookup = new FakeCharacterLookup();

    await expect(lookUpRegistration(registration.id, lookup)).resolves.toBeNull();
    expect(lookup.calls).toBe(0);
  });
});

describe('approveRegistration', () => {
  it('adds a new member with the character as their main', async () => {
    const registration = await register();

    const approved = await approveRegistration(guild, registration.id, byHand, gm);

    const member = await Member.findOne({
      where: { guildId: guild.id, discordUserId: thrall.discordUserId },
      include: [{ model: Character, as: 'characters' }],
    });
    expect(member).toMatchObject({ rank: 'member', locale: 'es' });
    expect(member!.characters).toEqual([
      expect.objectContaining({
        name: 'Thrall',
        faction: 'horde',
        race: 'orc',
        characterClass: 'shaman',
        level: 58,
        professions: ['alchemy'],
        isMain: true,
      }),
    ]);
    expect(approved).toMatchObject({
      status: 'approved',
      characterId: member!.characters![0]!.id,
      reviewedByUserId: gm.id,
    });
  });

  it('needs the race, class, and level when the lookup found nothing', async () => {
    const registration = await register();

    const error = await approveRegistration(guild, registration.id, {}, gm).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(DomainValidationError);
    expect((error as DomainValidationError).issues.map((issue) => issue.field).sort()).toEqual([
      'class',
      'level',
      'race',
    ]);
    await registration.reload();
    expect(registration.status).toBe('pending');
  });

  it('uses what the lookup found', async () => {
    const registration = await register();
    await lookUpRegistration(
      registration.id,
      new FakeCharacterLookup().addCharacter({
        name: 'Thrall',
        faction: 'horde',
        race: 'troll',
        characterClass: 'priest',
        level: 42,
      }),
    );

    await approveRegistration(guild, registration.id, { ...byHand, level: 1 }, gm);

    const character = await Character.findOne({ where: { name: 'Thrall' } });
    expect(character).toMatchObject({ race: 'troll', characterClass: 'priest', level: 42 });
  });

  it("adds an alt to a member who's on the roster", async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm, [shaman]);
    const registration = await register('Zuljin');

    await approveRegistration(guild, registration.id, { ...byHand, race: 'troll' }, gm);

    const characters = await Character.findAll({ where: { memberId: member.id } });
    expect(characters.map((c) => [c.name, c.isMain]).sort()).toEqual([
      ['Thrall', true],
      ['Zuljin', false],
    ]);
  });

  it('restores a removed member with their history, and their character if it was theirs', async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm, [shaman]);
    await removeMember(member, guild);
    const registration = await register('Thrall');

    const approved = await approveRegistration(guild, registration.id, byHand, gm);

    await member.reload();
    expect(member.removedAt).toBeNull();
    expect(member.rank).toBe('raider');
    const characters = await Character.findAll({ where: { memberId: member.id } });
    expect(characters).toHaveLength(1);
    expect(approved.characterId).toBe(characters[0]!.id);
  });

  it('keeps the registration pending when the name was taken meanwhile', async () => {
    const registration = await register();
    const jaina = {
      discordUserId: '200000000000000003',
      discordName: 'Jaina',
      discordAvatar: null,
    };
    await addMember(guild, jaina, 'raider', gm, [shaman]);

    await expect(approveRegistration(guild, registration.id, byHand, gm)).rejects.toThrow(
      DomainValidationError,
    );
    await registration.reload();
    expect(registration.status).toBe('pending');
    expect(await Member.count({ where: { discordUserId: thrall.discordUserId } })).toBe(0);
  });

  it('refuses a registration that was already reviewed', async () => {
    const registration = await register();
    await rejectRegistration(guild, registration.id, gm);

    await expect(approveRegistration(guild, registration.id, byHand, gm)).rejects.toEqual(
      new DomainError({ code: 'REGISTRATION_NOT_PENDING' }),
    );
  });

  it("doesn't find another guild's registration", async () => {
    const registration = await register();
    const otherGm = await User.create({
      discordId: '200000000000000009',
      name: 'Vol',
      avatar: null,
    });
    const other = await createTestGuild(otherGm, { serverId: otherServerId });

    await expect(approveRegistration(other, registration.id, byHand, otherGm)).rejects.toEqual(
      new DomainError({ code: 'NOT_FOUND' }),
    );
  });
});

describe('rejectRegistration', () => {
  it('records who rejected it and frees the name for a new registration', async () => {
    const registration = await register();

    const rejected = await rejectRegistration(guild, registration.id, gm);

    expect(rejected).toMatchObject({ status: 'rejected', reviewedByUserId: gm.id });
    expect(rejected.rejectionReason).toBeNull();
    expect(await CharacterRegistration.count({ where: { status: 'pending' } })).toBe(0);
    await expect(register()).resolves.toBeDefined();
  });
});
