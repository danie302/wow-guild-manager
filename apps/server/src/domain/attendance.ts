import type { AttendanceStatus, CombatRole, SaveAttendanceInput } from '@wgm/shared';
import { Transaction } from 'sequelize';

import {
  Attendance,
  AttendanceChange,
  Character,
  Event,
  Member,
  SignUp,
  User,
  type Guild,
} from '../db/models/index.js';
import { transaction } from '../db/transaction.js';
import { DomainError, DomainValidationError } from './errors.js';

/** One row of an event's attendance list. */
export interface AttendanceRow {
  member: Member;
  character: Character;
  role: CombatRole | null;
  signedUp: boolean;
  status: AttendanceStatus;
}

/** Where a sign-up starts on the list before the first save. */
function prefilled(signUp: SignUp): AttendanceStatus {
  if (signUp.status === 'declined') return 'absent_with_notice';
  return signUp.placement === 'waitlist' ? 'bench' : 'present';
}

/**
 * The event's attendance list: the saved records once attendance was saved, otherwise a draft
 * pre-filled from the sign-ups (Confirmed and Tentative Present, waitlisted Bench, Declined
 * Absent with notice).
 */
export async function attendanceList(event: Event): Promise<AttendanceRow[]> {
  const signUps = await SignUp.findAll({
    where: { eventId: event.id },
    include: [
      { model: Member, as: 'member' },
      { model: Character, as: 'character' },
    ],
    order: [['signedUpAt', 'ASC']],
  });
  const roleOf = new Map(signUps.map((signUp) => [signUp.memberId, signUp.role]));
  if (!event.attendanceRecordedAt) {
    return signUps.map((signUp) => ({
      member: signUp.member!,
      character: signUp.character!,
      role: signUp.role,
      signedUp: true,
      status: prefilled(signUp),
    }));
  }
  const records = await Attendance.findAll({
    where: { eventId: event.id },
    include: [
      { model: Member, as: 'member' },
      { model: Character, as: 'character' },
    ],
    order: [['createdAt', 'ASC']],
  });
  return records.map((record) => ({
    member: record.member!,
    character: record.character!,
    role: roleOf.get(record.memberId) ?? null,
    signedUp: roleOf.has(record.memberId),
    status: record.status,
  }));
}

/** Corrections after the first save, newest first. */
export async function attendanceHistory(eventId: string): Promise<AttendanceChange[]> {
  return AttendanceChange.findAll({
    include: [
      {
        model: Attendance,
        as: 'attendance',
        where: { eventId },
        include: [{ model: Character, as: 'character', attributes: ['name', 'characterClass'] }],
      },
      { model: User, as: 'changedBy', attributes: ['name'] },
    ],
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
  });
}

/** Attendance opens when the event starts; a cancelled event has none. */
export function attendanceOpen(event: Event, now = new Date()): boolean {
  return !event.cancelledAt && event.startsAt <= now;
}

/**
 * Saves the event's attendance list. Each member must have signed up, or be an active roster
 * member added to the list (who comes with their main). The first save stores the list as it
 * is; after it, each status change and each added member is a correction, recorded with who
 * made it and when, and members can't be taken off. Locks the event, so two saves take turns.
 */
export async function saveAttendance(
  guild: Guild,
  eventId: string,
  { records }: SaveAttendanceInput,
  by: User,
  now = new Date(),
): Promise<void> {
  await transaction(async () => {
    const event = await Event.findOne({
      where: { id: eventId, guildId: guild.id },
      lock: Transaction.LOCK.UPDATE,
    });
    if (!event) throw new DomainError({ code: 'NOT_FOUND' });
    if (event.cancelledAt) throw new DomainError({ code: 'EVENT_CANCELLED' });
    if (!attendanceOpen(event, now)) throw new DomainError({ code: 'ATTENDANCE_NOT_OPEN' });

    const signUps = await SignUp.findAll({ where: { eventId: event.id } });
    const characterOf = new Map(signUps.map((s) => [s.memberId, s.characterId]));
    const existing = new Map(
      (await Attendance.findAll({ where: { eventId: event.id } })).map((r) => [r.memberId, r]),
    );
    const seen = new Set<string>();
    for (const [index, { memberId, status }] of records.entries()) {
      const invalid = () =>
        new DomainValidationError([{ field: `records.${index}.memberId`, code: 'INVALID_VALUE' }]);
      if (seen.has(memberId)) throw invalid();
      seen.add(memberId);

      const record = existing.get(memberId);
      if (record) {
        if (record.status === status) continue;
        const fromStatus = record.status;
        await record.update({ status });
        await AttendanceChange.create({
          attendanceId: record.id,
          fromStatus,
          toStatus: status,
          changedByUserId: by.id,
        });
        continue;
      }
      const characterId = characterOf.get(memberId) ?? (await mainOf(guild, memberId));
      if (!characterId) throw invalid();
      const created = await Attendance.create({ eventId: event.id, memberId, characterId, status });
      // After the first save, an added member is a correction too.
      if (event.attendanceRecordedAt) {
        await AttendanceChange.create({
          attendanceId: created.id,
          fromStatus: null,
          toStatus: status,
          changedByUserId: by.id,
        });
      }
    }
    if (!event.attendanceRecordedAt) {
      await event.update({ attendanceRecordedAt: now, attendanceRecordedByUserId: by.id });
    }
  });
}

/** The main of an active roster member of the guild, for a member added to the list. */
async function mainOf(guild: Guild, memberId: string): Promise<string | null> {
  const member = await Member.findOne({
    where: { id: memberId, guildId: guild.id, removedAt: null },
    include: [{ model: Character, as: 'characters', where: { removedAt: null }, required: false }],
  });
  const characters = member?.characters ?? [];
  return (characters.find((character) => character.isMain) ?? characters[0])?.id ?? null;
}
