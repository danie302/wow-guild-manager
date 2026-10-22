import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestGuild } from '../../../test/test-guild.js';
import {
  Attendance,
  Character,
  Event,
  Member,
  SignUp,
  User,
  type Guild,
} from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { attendanceHistory, attendanceList, saveAttendance } from '../attendance.js';
import { DomainError, DomainValidationError } from '../errors.js';
import { cancelEvent, createEvent } from '../events.js';

const serverId = '300000000000000001';
const hour = 60 * 60 * 1000;

let sequelize: Sequelize;
let gm: User;
let guild: Guild;
let discordIds = 200000000000000100n;

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

async function member(name: string) {
  const discordUserId = String(discordIds++);
  const created = await Member.create({
    guildId: guild.id,
    discordUserId,
    discordName: name,
    discordAvatar: null,
    rank: 'raider',
  });
  const character = await Character.create({
    memberId: created.id,
    name,
    faction: 'horde',
    race: 'orc',
    characterClass: 'warrior',
    level: 60,
    professions: [],
    isMain: true,
  });
  return { member: created, character };
}

/** A raid that started an hour ago, with a confirmed, a waitlisted, and a declined member. */
async function startedRaid() {
  const event = await createEvent(
    guild,
    {
      type: 'raid',
      name: 'Molten Core',
      description: '',
      startsAt: new Date(Date.now() + hour).toISOString(),
      size: 10,
      slots: { tank: 1, healer: 2, dps: 7 },
    },
    gm,
  );
  const [confirmed, waiting, declined] = [
    await member('Thrall'),
    await member('Rexxar'),
    await member('Cairne'),
  ];
  const signUp = (who: typeof confirmed, extra: Partial<SignUp>) =>
    SignUp.create({
      eventId: event.id,
      memberId: who.member.id,
      characterId: who.character.id,
      role: 'tank',
      status: 'confirmed',
      placement: 'slot',
      signedUpAt: new Date(),
      ...extra,
    });
  await signUp(confirmed, {});
  await signUp(waiting, { placement: 'waitlist' });
  await signUp(declined, { role: null, status: 'declined', placement: null });
  await event.update({ startsAt: new Date(Date.now() - hour) });
  return { event, confirmed, waiting, declined };
}

const statuses = async (event: Event) =>
  (await attendanceList(await event.reload())).map((row) => [row.character.name, row.status]);

describe('attendance', () => {
  it('starts from the sign-ups: Present, Bench, and Absent with notice', async () => {
    const { event } = await startedRaid();

    expect(await statuses(event)).toEqual([
      ['Thrall', 'present'],
      ['Rexxar', 'bench'],
      ['Cairne', 'absent_with_notice'],
    ]);
  });

  it('saves the list, then records each correction with who made it', async () => {
    const { event, confirmed, waiting } = await startedRaid();
    const all = (thrall: 'present' | 'late') => ({
      records: [
        { memberId: confirmed.member.id, status: thrall },
        { memberId: waiting.member.id, status: 'bench' as const },
      ],
    });

    await saveAttendance(guild, event.id, all('present'), gm);
    expect(await attendanceHistory(event.id)).toEqual([]);

    await saveAttendance(guild, event.id, all('late'), gm);

    expect(await statuses(event)).toEqual([
      ['Thrall', 'late'],
      ['Rexxar', 'bench'],
    ]);
    const [change] = await attendanceHistory(event.id);
    expect(change).toMatchObject({
      fromStatus: 'present',
      toStatus: 'late',
      changedByUserId: gm.id,
    });
  });

  it('adds a roster member who did not sign up, with their main', async () => {
    const { event, confirmed } = await startedRaid();
    const caller = await member('Varok');
    await saveAttendance(
      guild,
      event.id,
      { records: [{ memberId: confirmed.member.id, status: 'present' }] },
      gm,
    );

    await saveAttendance(
      guild,
      event.id,
      { records: [{ memberId: caller.member.id, status: 'present' }] },
      gm,
    );

    const added = await Attendance.findOne({ where: { memberId: caller.member.id } });
    expect(added?.characterId).toBe(caller.character.id);
    // After the first save, the addition is a correction; members left out stay.
    expect((await attendanceHistory(event.id))[0]).toMatchObject({ fromStatus: null });
    expect(await Attendance.count({ where: { eventId: event.id } })).toBe(2);
  });

  it('refuses before the event starts, for a cancelled event, and for strangers', async () => {
    const { event, confirmed } = await startedRaid();
    const save = (memberId: string) =>
      saveAttendance(guild, event.id, { records: [{ memberId, status: 'present' }] }, gm);

    await expect(save('00000000-0000-7000-8000-000000000001')).rejects.toBeInstanceOf(
      DomainValidationError,
    );
    await event.update({ startsAt: new Date(Date.now() + hour) });
    await expect(save(confirmed.member.id)).rejects.toEqual(
      new DomainError({ code: 'ATTENDANCE_NOT_OPEN' }),
    );
    await cancelEvent(guild, event.id, gm);
    await expect(save(confirmed.member.id)).rejects.toEqual(
      new DomainError({ code: 'EVENT_CANCELLED' }),
    );
  });
});
