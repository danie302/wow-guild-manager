import type { AttendanceStatus } from '@wgm/shared';
import {
  DataTypes,
  literal,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
  type Sequelize,
} from 'sequelize';

import { Character } from './character.js';
import { Event } from './event.js';
import { Member } from './member.js';
import { User } from './user.js';

/** A member's attendance at an event, with the character they came with (domain/attendance.ts). */
export class Attendance extends Model<
  InferAttributes<Attendance>,
  InferCreationAttributes<Attendance>
> {
  declare id: CreationOptional<string>;
  declare eventId: ForeignKey<Event['id']>;
  declare memberId: ForeignKey<Member['id']>;
  declare characterId: ForeignKey<Character['id']>;
  declare status: AttendanceStatus;

  declare member?: NonAttribute<Member>;
  declare character?: NonAttribute<Character>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    Attendance.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: literal('uuidv7()') },
        status: { type: DataTypes.STRING(16), allowNull: false },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'attendance' },
    );
  }

  static associate(): void {
    Attendance.belongsTo(Event, { foreignKey: { name: 'eventId', allowNull: false }, as: 'event' });
    Attendance.belongsTo(Member, {
      foreignKey: { name: 'memberId', allowNull: false },
      as: 'member',
    });
    Attendance.belongsTo(Character, {
      foreignKey: { name: 'characterId', allowNull: false },
      as: 'character',
    });
    Attendance.hasMany(AttendanceChange, { foreignKey: 'attendanceId', as: 'changes' });
  }
}

/** A correction to an attendance record after it was first saved. */
export class AttendanceChange extends Model<
  InferAttributes<AttendanceChange>,
  InferCreationAttributes<AttendanceChange>
> {
  declare id: CreationOptional<string>;
  declare attendanceId: ForeignKey<Attendance['id']>;
  /** Null when the member was added to the list after the first save. */
  declare fromStatus: AttendanceStatus | null;
  declare toStatus: AttendanceStatus;
  /** Null when that account no longer exists. */
  declare changedByUserId: ForeignKey<User['id']> | null;

  declare attendance?: NonAttribute<Attendance>;
  declare changedBy?: NonAttribute<User | null>;

  declare createdAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    AttendanceChange.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: literal('uuidv7()') },
        fromStatus: { type: DataTypes.STRING(16), allowNull: true },
        toStatus: { type: DataTypes.STRING(16), allowNull: false },
        changedByUserId: { type: DataTypes.UUID, allowNull: true },
        createdAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'attendance_changes', updatedAt: false },
    );
  }

  static associate(): void {
    AttendanceChange.belongsTo(Attendance, {
      foreignKey: { name: 'attendanceId', allowNull: false },
      as: 'attendance',
    });
    AttendanceChange.belongsTo(User, { foreignKey: 'changedByUserId', as: 'changedBy' });
  }
}
