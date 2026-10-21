import type { CharacterInput } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestGuild } from '../../../test/test-guild.js';
import { Character, User, type Guild, type Member } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { DomainError, DomainValidationError } from '../errors.js';
import {
  addCharacter,
  addMember,
  removeCharacter,
  removeMember,
  removeOwnCharacter,
  updateCharacter,
} from '../roster.js';

const serverId = '300000000000000001';
const thrall = { discordUserId: '200000000000000002', discordName: 'Thrall', discordAvatar: null };
const jaina = { discordUserId: '200000000000000003', discordName: 'Jaina', discordAvatar: null };

const shaman: CharacterInput = {
  name: 'Thrall',
  faction: 'horde',
  race: 'orc',
  class: 'shaman',
  level: 60,
  professions: ['alchemy'],
};
const priest: CharacterInput = { ...shaman, name: 'Zuljin', race: 'troll', class: 'priest' };
const warrior: CharacterInput = { ...shaman, name: 'Saurfang', class: 'warrior' };

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
  ({ member } = await addMember(guild, thrall, 'raider', gm, [shaman, priest, warrior]));
});

const named = (name: string) => Character.findOne({ where: { name } });
async function active() {
  const characters = await Character.findAll({
    where: { memberId: member.id, removedAt: null },
    order: [['name', 'ASC']],
  });
  return characters.map((c) => [c.name, c.isMain]);
}

describe('updateCharacter', () => {
  it('changes every detail but the faction', async () => {
    const zuljin = (await named('Zuljin'))!;

    await updateCharacter(member, guild, zuljin.id, {
      ...priest,
      name: 'Vol',
      race: 'undead',
      class: 'mage',
      level: 42,
      professions: [],
    });

    await zuljin.reload();
    expect(zuljin).toMatchObject({
      name: 'Vol',
      race: 'undead',
      characterClass: 'mage',
      level: 42,
      professions: [],
      faction: 'horde',
    });
  });

  it('keeps its own name, in another case, but not a name another character has', async () => {
    const zuljin = (await named('Zuljin'))!;

    await updateCharacter(member, guild, zuljin.id, { ...priest, name: 'ZULJIN' });
    const error = await updateCharacter(member, guild, zuljin.id, {
      ...priest,
      name: 'thrall',
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DomainValidationError);
    expect((error as DomainValidationError).issues).toEqual([
      { field: 'name', code: 'CHARACTER_NAME_TAKEN' },
    ]);
  });

  it('checks the game rules and the faction', async () => {
    const zuljin = (await named('Zuljin'))!;

    await expect(
      updateCharacter(member, guild, zuljin.id, { ...priest, race: 'human' }),
    ).rejects.toThrow(DomainValidationError);
    await expect(
      updateCharacter(member, guild, zuljin.id, {
        ...priest,
        faction: 'alliance',
        race: 'human',
      }),
    ).rejects.toThrow(DomainValidationError);
  });

  it("doesn't find another member's character", async () => {
    const other = await addMember(guild, jaina, 'raider', gm);
    const zuljin = (await named('Zuljin'))!;

    await expect(updateCharacter(other.member, guild, zuljin.id, priest)).rejects.toEqual(
      new DomainError({ code: 'NOT_FOUND' }),
    );
  });
});

describe('removeCharacter', () => {
  it('keeps the record and frees the name', async () => {
    const zuljin = (await named('Zuljin'))!;

    await removeCharacter(member, zuljin.id);

    await zuljin.reload();
    expect(zuljin.removedAt).not.toBeNull();
    const other = await addMember(guild, jaina, 'raider', gm, [priest]);
    expect(other.member.id).toBeDefined();
  });

  it('makes the oldest remaining character the main when the main goes', async () => {
    await removeCharacter(member, (await named('Thrall'))!.id);

    expect(await active()).toEqual([
      ['Saurfang', false],
      ['Zuljin', true],
    ]);
  });

  it('can leave a member without characters', async () => {
    for (const name of ['Thrall', 'Zuljin', 'Saurfang']) {
      await removeCharacter(member, (await named(name))!.id);
    }

    expect(await active()).toEqual([]);
    await member.reload();
    expect(member.removedAt).toBeNull();
  });

  it('restores the record when the member gets the same name again', async () => {
    const zuljin = (await named('Zuljin'))!;
    await removeCharacter(member, zuljin.id);

    const back = await addCharacter(member, guild, { ...priest, name: 'zuljin', level: 59 });

    expect(back.id).toBe(zuljin.id);
    expect(back).toMatchObject({ name: 'zuljin', level: 59, removedAt: null, isMain: false });
  });

  it("isn't brought back when the member is removed and added back", async () => {
    await removeCharacter(member, (await named('Zuljin'))!.id);
    await removeMember(member, guild);

    await addMember(guild, thrall, 'member', gm);

    expect(await active()).toEqual([
      ['Saurfang', false],
      ['Thrall', true],
    ]);
  });
});

describe('removeOwnCharacter', () => {
  it('removes one of their characters and says which is the main now', async () => {
    const outcome = await removeOwnCharacter(
      serverId,
      thrall.discordUserId,
      (await named('Thrall'))!.id,
    );

    expect(outcome).toEqual({ result: 'removed', name: 'Thrall', newMain: 'Zuljin' });
  });

  it("refuses someone else's character, or one already removed", async () => {
    await addMember(guild, jaina, 'raider', gm);
    const zuljin = (await named('Zuljin'))!;

    expect((await removeOwnCharacter(serverId, jaina.discordUserId, zuljin.id)).result).toBe(
      'not_your_character',
    );
    await removeCharacter(member, zuljin.id);
    expect((await removeOwnCharacter(serverId, thrall.discordUserId, zuljin.id)).result).toBe(
      'not_your_character',
    );
  });
});
