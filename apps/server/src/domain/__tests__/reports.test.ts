import type { AttendanceStatus, EventType } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestGuild } from '../../../test/test-guild.js';
import { Attendance, Character, Event, Member, User, type Guild } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { attendanceReport, memberAttendance, rosterRates } from '../reports.js';

const serverId = '300000000000000001';
const day = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-22T12:00:00Z');

let sequelize: Sequelize;
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
  const gm = await User.create({ discordId: '200000000000000001', name: 'Garrosh', avatar: null });
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

/** An event `daysAgo` with the members' statuses recorded. */
async function event(
  daysAgo: number,
  statuses: [Awaited<ReturnType<typeof member>>, AttendanceStatus][],
  type: EventType = 'raid',
) {
  const startsAt = new Date(now.getTime() - daysAgo * day);
  const created = await Event.create({
    guildId: guild.id,
    type,
    name: `${type} ${daysAgo}`,
    description: '',
    startsAt,
    tentativeDeadlineAt: startsAt,
    size: 10,
    tankSlots: 1,
    healerSlots: 2,
    dpsSlots: 7,
    createdByUserId: null,
  });
  for (const [who, status] of statuses) {
    await Attendance.create({
      eventId: created.id,
      memberId: who.member.id,
      characterId: who.character.id,
      status,
    });
  }
  return created;
}

describe('attendance reports', () => {
  it("works out a member's rate per period and event type, with late arrivals, bench, and no-shows", async () => {
    const thrall = await member('Thrall');
    await event(3, [[thrall, 'present']]);
    await event(10, [[thrall, 'late']], 'dungeon');
    await event(40, [[thrall, 'no_show']]);
    await event(100, [[thrall, 'bench']]);

    const recent = await memberAttendance(thrall.member, guild, '4', now);
    const eight = await memberAttendance(thrall.member, guild, '8', now);
    const all = await memberAttendance(thrall.member, guild, 'all', now);

    expect(recent.overall).toMatchObject({ attended: 2, total: 2, rate: 1, band: 'good' });
    expect(eight.overall).toMatchObject({ attended: 2, total: 3, band: 'at_risk' });
    expect(eight.byType.dungeon).toEqual({ attended: 1, total: 1, rate: 1 });
    expect(all).toMatchObject({ late: 1, bench: 1, noShow: 1 });
    // Bench counts as attended.
    expect(all.overall).toMatchObject({ attended: 3, total: 4 });
    expect(all.history.map((row) => row.status)).toEqual(['present', 'late', 'no_show', 'bench']);
  });

  it('compares members, counts bands, and leaves out removed members', async () => {
    const [good, watch, risk, none, removed] = [
      await member('Good'),
      await member('Watch'),
      await member('Risk'),
      await member('None'),
      await member('Removed'),
    ];
    await removed.member.update({ removedAt: now });
    for (let index = 0; index < 5; index++) {
      await event(index + 1, [
        [good, 'present'],
        [watch, index === 0 ? 'no_show' : 'present'],
        [risk, index < 2 ? 'no_show' : 'present'],
        [removed, 'present'],
      ]);
    }
    await event(2, [[good, 'present']], 'pvp');

    const report = await attendanceReport(guild, '8', 'raid', now);

    expect(report.members.map((row) => [row.discordName, row.rate, row.band])).toEqual([
      ['Garrosh', null, null],
      ['Good', 1, 'good'],
      ['None', null, null],
      ['Risk', 0.6, 'at_risk'],
      ['Watch', 0.8, 'watch'],
    ]);
    expect(report.bands).toEqual({ good: 1, watch: 1, at_risk: 1 });
    expect(report.average).toBeCloseTo(0.8);
    expect(none).toBeDefined();
  });

  it("gives the roster each member's rate over the last 8 weeks", async () => {
    const thrall = await member('Thrall');
    await event(3, [[thrall, 'present']]);
    await event(70, [[thrall, 'no_show']]);

    expect((await rosterRates([thrall.member.id], now)).get(thrall.member.id)).toBe(1);
  });
});
