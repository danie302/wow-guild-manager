import {
  ATTENDANCE_BANDS,
  attendanceBand,
  attendancePeriodStart,
  attendanceRate,
  EVENT_TYPES,
  type AttendanceBand,
  type AttendancePeriod,
  type AttendanceReportResponse,
  type EventType,
  type MemberAttendanceResponse,
} from '@wgm/shared';
import { Op, type WhereOptions } from 'sequelize';

import { Attendance, Character, Event, Member, type Guild } from '../db/models/index.js';
import { rankResolver } from './ranks.js';

/** The guild's thresholds, in percent. */
export function thresholdsOf(guild: Guild) {
  return { good: guild.attendanceGoodThreshold, atRisk: guild.attendanceRiskThreshold };
}

/**
 * Attendance records of these members within the period (by the event's start), of one event
 * type or all, with their event and character, newest first. Removed members' records stay in
 * the database, so they still count for the events they were in.
 */
async function records(
  memberIds: string[],
  period: AttendancePeriod,
  type: EventType | 'all',
  now: Date,
): Promise<Attendance[]> {
  if (memberIds.length === 0) return [];
  const since = attendancePeriodStart(period, now);
  const eventWhere: WhereOptions<Event> = {
    startsAt: since ? { [Op.gte]: since, [Op.lte]: now } : { [Op.lte]: now },
    cancelledAt: null,
    ...(type !== 'all' && { type }),
  };
  return Attendance.findAll({
    where: { memberId: memberIds },
    include: [
      { model: Event, as: 'event', where: eventWhere },
      { model: Character, as: 'character', attributes: ['name', 'characterClass'] },
    ],
    order: [[{ model: Event, as: 'event' }, 'startsAt', 'DESC']],
  });
}

/** A member's attendance: overall with its band, per event type, and their history. */
export async function memberAttendance(
  member: Member,
  guild: Guild,
  period: AttendancePeriod,
  now = new Date(),
): Promise<MemberAttendanceResponse> {
  const rows = await records([member.id], period, 'all', now);
  const overall = attendanceRate(rows.map((row) => row.status));
  return {
    period,
    overall: { ...overall, band: attendanceBand(overall.rate, thresholdsOf(guild)) },
    byType: Object.fromEntries(
      EVENT_TYPES.map((type) => [
        type,
        attendanceRate(rows.filter((row) => row.event!.type === type).map((row) => row.status)),
      ]),
    ) as MemberAttendanceResponse['byType'],
    late: rows.filter((row) => row.status === 'late').length,
    noShow: rows.filter((row) => row.status === 'no_show').length,
    history: rows.map((row) => ({
      eventId: row.eventId,
      name: row.event!.name,
      type: row.event!.type,
      startsAt: row.event!.startsAt.toISOString(),
      character: { name: row.character!.name, class: row.character!.characterClass },
      status: row.status,
    })),
  };
}

/**
 * Every active roster member's attendance in the period (and event type), to compare them:
 * rate, attended and total events, late arrivals, no-shows, and band. The guild average is the
 * mean of the members' rates, leaving out those without records, as do the band counts.
 */
export async function attendanceReport(
  guild: Guild,
  period: AttendancePeriod,
  type: EventType | 'all',
  now = new Date(),
): Promise<AttendanceReportResponse> {
  const members = await Member.findAll({
    where: { guildId: guild.id, removedAt: null },
    include: [{ model: Character, as: 'characters', where: { removedAt: null }, required: false }],
    order: [['discordName', 'ASC']],
  });
  const rankOf = await rankResolver(guild);
  const all = await records(
    members.map((member) => member.id),
    period,
    type,
    now,
  );
  const thresholds = thresholdsOf(guild);
  const rows = members.map((member) => {
    const mine = all.filter((row) => row.memberId === member.id);
    const rate = attendanceRate(mine.map((row) => row.status));
    const main = member.characters!.find((character) => character.isMain) ?? member.characters![0];
    return {
      memberId: member.id,
      discordName: member.discordName,
      rank: rankOf(member),
      main: main ? { name: main.name, class: main.characterClass } : null,
      ...rate,
      late: mine.filter((row) => row.status === 'late').length,
      noShow: mine.filter((row) => row.status === 'no_show').length,
      band: attendanceBand(rate.rate, thresholds),
    };
  });
  const rates = rows.flatMap((row) => (row.rate === null ? [] : [row.rate]));
  return {
    period,
    type,
    thresholds,
    average: rates.length === 0 ? null : rates.reduce((sum, rate) => sum + rate, 0) / rates.length,
    bands: Object.fromEntries(
      ATTENDANCE_BANDS.map((band) => [band, rows.filter((row) => row.band === band).length]),
    ) as Record<AttendanceBand, number>,
    members: rows,
  };
}

/** Each member's rate over the last 8 weeks, for the roster. */
export async function rosterRates(
  memberIds: string[],
  now = new Date(),
): Promise<Map<string, number | null>> {
  const all = await records(memberIds, '8', 'all', now);
  return new Map(
    memberIds.map((id) => [
      id,
      attendanceRate(all.filter((row) => row.memberId === id).map((row) => row.status)).rate,
    ]),
  );
}
