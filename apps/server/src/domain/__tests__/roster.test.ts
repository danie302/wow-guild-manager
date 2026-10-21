import type { CharacterInput } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  FakeDiscordDirectory,
  MANAGE_GUILD,
  role,
  server,
} from '../../../test/fake-discord-directory.js';
import { Character, Guild, Member, OfficerNote, RankChange, User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { DomainError, DomainValidationError } from '../errors.js';
import { createGuild } from '../guilds.js';
import { replaceGuildOfficers, updateServerMember } from '../officers.js';
import { memberRank } from '../ranks.js';
import {
  addCharacter,
  addMember,
  addOfficerNote,
  changeRank,
  recordMemberLocale,
  removeMember,
  setMainCharacter,
} from '../roster.js';

const serverId = '300000000000000001';
const officerRole = '400000000000000001';

const thrall = { discordUserId: '200000000000000002', discordName: 'Thrall', discordAvatar: null };
const jaina = { discordUserId: '200000000000000003', discordName: 'Jaina', discordAvatar: null };

const shaman: CharacterInput = {
  name: 'Thrall',
  faction: 'horde',
  race: 'orc',
  class: 'shaman',
  level: 60,
  professions: ['alchemy', 'herbalism'],
};
const priest: CharacterInput = { ...shaman, name: 'Zuljin', race: 'troll', class: 'priest' };

let sequelize: Sequelize;
let guild: Guild;
let gm: User;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
  gm = await User.create({ discordId: '200000000000000001', name: 'Garrosh', avatar: null });
  const discord = new FakeDiscordDirectory()
    .addServer(
      server(serverId, 'Orgrimmar', {
        roles: [
          role(officerRole, 'Officers'),
          role('400000000000000002', 'Admins', { permissions: MANAGE_GUILD }),
        ],
      }),
    )
    .addMember(serverId, gm.discordId, ['400000000000000002']);
  guild = await createGuild(
    gm,
    { name: 'Horde', faction: 'horde', discordServerId: serverId, officerRoleId: officerRole },
    discord,
  );
});

async function history(member: Member) {
  const changes = await RankChange.findAll({
    where: { memberId: member.id },
    order: [['createdAt', 'ASC']],
  });
  return changes.map((change) => [change.fromRank, change.toRank, change.source]);
}

async function activeCharacters(member: Member) {
  const characters = await Character.findAll({
    where: { memberId: member.id, removedAt: null },
    order: [['createdAt', 'ASC']],
  });
  return characters.map((character) => [character.name, character.isMain]);
}

function validationCodes(err: unknown) {
  return err instanceof DomainValidationError
    ? err.issues.map((issue) => [issue.field, issue.code])
    : err;
}

describe('the roster', () => {
  it("puts the Guild Master on a new guild's roster", async () => {
    const member = await Member.findOne({ where: { guildId: guild.id } });

    expect(member).toMatchObject({ discordUserId: gm.discordId, discordName: 'Garrosh' });
    expect(await memberRank(member!, guild)).toBe('guild_master');
    expect(await history(member!)).toEqual([[null, 'guild_master', 'app']]);
  });

  it('adds a member with characters, the first one as main', async () => {
    const { member, restored } = await addMember(guild, thrall, 'raider', gm, [shaman, priest]);

    expect(restored).toBe(false);
    expect(await activeCharacters(member)).toEqual([
      ['Thrall', true],
      ['Zuljin', false],
    ]);
    const stored = await Character.findOne({ where: { name: 'Thrall' } });
    expect(stored).toMatchObject({
      race: 'orc',
      characterClass: 'shaman',
      professions: ['alchemy', 'herbalism'],
    });
    expect(await history(member)).toEqual([[null, 'raider', 'app']]);
  });

  it('lets the same Discord user be on the roster of another guild', async () => {
    const other = await Guild.create({
      name: 'Other',
      faction: 'horde',
      discordServerId: '300000000000000002',
      officerRoleId: officerRole,
      guildMasterUserId: (
        await User.create({ discordId: '200000000000000009', name: 'Vol', avatar: null })
      ).id,
    });
    await addMember(guild, thrall, 'raider', gm);

    await expect(addMember(other, thrall, 'member', null)).resolves.toBeDefined();
  });

  it('rejects someone who is already on the roster', async () => {
    await addMember(guild, thrall, 'raider', gm);

    await expect(addMember(guild, thrall, 'raider', gm)).rejects.toThrow(DomainError);
  });

  it('checks characters with the shared schema, and saves nothing when one is invalid', async () => {
    const humanShaman = { ...priest, race: 'human' as const, faction: 'horde' as const };

    const error = await addMember(guild, thrall, 'raider', gm, [shaman, humanShaman]).catch(
      (err: unknown) => err,
    );

    expect(validationCodes(error)).toEqual([['characters.1.race', 'RACE_NOT_IN_FACTION']]);
    expect(await Member.count({ where: { discordUserId: thrall.discordUserId } })).toBe(0);
  });

  it("rejects a character whose faction isn't the guild's", async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm);
    const alliance: CharacterInput = { ...shaman, faction: 'alliance', race: 'dwarf' };

    const error = await addCharacter(member, guild, alliance).catch((err: unknown) => err);

    expect(validationCodes(error)).toEqual([['faction', 'CHARACTER_WRONG_FACTION']]);
  });

  it('keeps character names unique across the game, ignoring case', async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm, [shaman]);
    const { member: other } = await addMember(guild, jaina, 'raider', gm);

    const error = await addCharacter(other, guild, { ...priest, name: 'THRALL' }).catch(
      (err: unknown) => err,
    );

    expect(validationCodes(error)).toEqual([['name', 'CHARACTER_NAME_TAKEN']]);
    // The database enforces it too, even if a request skips the check.
    await expect(
      Character.create({
        ...priest,
        name: 'thrall',
        characterClass: 'priest',
        memberId: member.id,
      }),
    ).rejects.toThrow();
  });

  it('allows only one main per member in the database', async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm, [shaman]);

    await expect(
      Character.create({ ...priest, characterClass: 'priest', memberId: member.id, isMain: true }),
    ).rejects.toThrow();
  });

  it('changes the main character', async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm, [shaman, priest]);
    const zuljin = await Character.findOne({ where: { name: 'Zuljin' } });

    await setMainCharacter(member, zuljin!.id);

    expect(await activeCharacters(member)).toEqual([
      ['Thrall', false],
      ['Zuljin', true],
    ]);
  });

  it('records rank changes with who made them', async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm);

    await changeRank(member, 'member', gm);

    const last = await RankChange.findOne({
      where: { memberId: member.id },
      order: [['createdAt', 'DESC']],
    });
    expect(last).toMatchObject({
      fromRank: 'raider',
      toRank: 'member',
      changedByUserId: gm.id,
      source: 'app',
    });
  });

  it('records gaining and losing the Officer role in Discord', async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm);

    await updateServerMember(serverId, thrall.discordUserId, [officerRole]);
    expect(await memberRank(member, guild)).toBe('officer');
    await replaceGuildOfficers(guild.id, []);

    expect(await history(member)).toEqual([
      [null, 'raider', 'app'],
      ['raider', 'officer', 'discord'],
      ['officer', 'raider', 'discord'],
    ]);
  });

  it("doesn't record the Officer role for the Guild Master", async () => {
    await updateServerMember(serverId, gm.discordId, [officerRole]);

    const member = await Member.findOne({ where: { discordUserId: gm.discordId } });
    expect(await history(member!)).toEqual([[null, 'guild_master', 'app']]);
  });

  it("can't remove the Guild Master", async () => {
    const member = await Member.findOne({ where: { discordUserId: gm.discordId } });

    await expect(removeMember(member!, guild)).rejects.toMatchObject({
      error: { code: 'GUILD_MASTER_CANNOT_BE_REMOVED' },
    });
  });

  it("keeps a removed member's records, and frees their character names", async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm, [shaman]);

    await removeMember(member, guild);

    expect((await member.reload()).removedAt).not.toBeNull();
    expect(await Character.count({ where: { memberId: member.id } })).toBe(1);
    const { member: other } = await addMember(guild, jaina, 'raider', gm);
    await expect(addCharacter(other, guild, shaman)).resolves.toBeDefined();
  });

  it('restores a removed member with their characters, rank history, and notes', async () => {
    const { member } = await addMember(guild, thrall, 'member', gm, [shaman, priest]);
    await addOfficerNote(member, gm, 'Trial until June.');
    await removeMember(member, guild);

    const result = await addMember(guild, { ...thrall, discordName: 'Thrall2' }, 'raider', gm);

    expect(result).toMatchObject({ restored: true, unrestoredCharacters: [] });
    expect(result.member.id).toBe(member.id);
    expect(result.member).toMatchObject({
      rank: 'member',
      discordName: 'Thrall2',
      removedAt: null,
    });
    expect(await activeCharacters(member)).toEqual([
      ['Thrall', true],
      ['Zuljin', false],
    ]);
    expect(await OfficerNote.count({ where: { memberId: member.id } })).toBe(1);
    expect(await history(member)).toEqual([[null, 'member', 'app']]);
  });

  it("leaves out a restored member's character whose name was taken, and picks a new main", async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm, [shaman, priest]);
    await removeMember(member, guild);
    const { member: other } = await addMember(guild, jaina, 'raider', gm);
    await addCharacter(other, guild, shaman);

    const { unrestoredCharacters } = await addMember(guild, thrall, 'raider', gm);

    expect(unrestoredCharacters.map((character) => character.name)).toEqual(['Thrall']);
    expect(await activeCharacters(member)).toEqual([['Zuljin', true]]);
  });

  it("stores the language of a member's latest bot interaction", async () => {
    const { member } = await addMember(guild, thrall, 'raider', gm);

    await recordMemberLocale(serverId, thrall.discordUserId, 'es');

    expect((await member.reload()).locale).toBe('es');
  });
});
