import type { EventType } from '@wgm/shared';
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

import { Event } from './event.js';
import { Guild } from './guild.js';
import { User } from './user.js';

/**
 * A weekly event, such as "MC every Tuesday" (see domain/series.ts). Its events follow
 * `startsAt` every 7 days at the same UTC time, and are created two weeks ahead.
 */
export class EventSeries extends Model<
  InferAttributes<EventSeries>,
  InferCreationAttributes<EventSeries>
> {
  declare id: CreationOptional<string>;
  declare guildId: ForeignKey<Guild['id']>;
  declare type: EventType;
  declare name: string;
  declare description: string;
  /** Its first event, or after an edit, the next one. */
  declare startsAt: Date;
  declare size: number;
  declare tankSlots: number;
  declare healerSlots: number;
  declare dpsSlots: number;
  /** The events' own Tentative deadline in hours; null uses the guild's. */
  declare tentativeDeadlineHours: CreationOptional<number | null>;
  declare createdByUserId: ForeignKey<User['id']> | null;
  declare stoppedAt: CreationOptional<Date | null>;
  declare stoppedByUserId: CreationOptional<ForeignKey<User['id']> | null>;

  declare events?: NonAttribute<Event[]>;
  declare createdBy?: NonAttribute<User | null>;
  declare stoppedBy?: NonAttribute<User | null>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    EventSeries.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: literal('uuidv7()') },
        type: { type: DataTypes.STRING(7), allowNull: false },
        name: { type: DataTypes.STRING(100), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
        startsAt: { type: DataTypes.DATE, allowNull: false },
        size: { type: DataTypes.SMALLINT, allowNull: false },
        tankSlots: { type: DataTypes.SMALLINT, allowNull: false },
        healerSlots: { type: DataTypes.SMALLINT, allowNull: false },
        dpsSlots: { type: DataTypes.SMALLINT, allowNull: false },
        tentativeDeadlineHours: { type: DataTypes.SMALLINT, allowNull: true },
        createdByUserId: { type: DataTypes.UUID, allowNull: true },
        stoppedAt: { type: DataTypes.DATE, allowNull: true },
        stoppedByUserId: { type: DataTypes.UUID, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'event_series' },
    );
  }

  static associate(): void {
    EventSeries.belongsTo(Guild, {
      foreignKey: { name: 'guildId', allowNull: false },
      as: 'guild',
    });
    EventSeries.hasMany(Event, { foreignKey: 'seriesId', as: 'events' });
    EventSeries.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });
    EventSeries.belongsTo(User, { foreignKey: 'stoppedByUserId', as: 'stoppedBy' });
  }
}
