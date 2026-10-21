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

import { Guild } from './guild.js';
import { User } from './user.js';

/** A raid, dungeon, or PvP event of a guild (see domain/events.ts). Times are UTC. */
export class Event extends Model<InferAttributes<Event>, InferCreationAttributes<Event>> {
  declare id: CreationOptional<string>;
  declare guildId: ForeignKey<Guild['id']>;
  /** Fixed once created. */
  declare type: EventType;
  declare name: string;
  declare description: string;
  declare startsAt: Date;
  declare size: number;
  declare tankSlots: number;
  declare healerSlots: number;
  declare dpsSlots: number;
  /** Null when the creator's account no longer exists. */
  declare createdByUserId: ForeignKey<User['id']> | null;
  declare cancelledAt: CreationOptional<Date | null>;
  declare cancelledByUserId: CreationOptional<ForeignKey<User['id']> | null>;

  declare createdBy?: NonAttribute<User | null>;
  declare cancelledBy?: NonAttribute<User | null>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    Event.init(
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
        createdByUserId: { type: DataTypes.UUID, allowNull: true },
        cancelledAt: { type: DataTypes.DATE, allowNull: true },
        cancelledByUserId: { type: DataTypes.UUID, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'events' },
    );
  }

  static associate(): void {
    Event.belongsTo(Guild, { foreignKey: { name: 'guildId', allowNull: false }, as: 'guild' });
    Event.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdBy' });
    Event.belongsTo(User, { foreignKey: 'cancelledByUserId', as: 'cancelledBy' });
  }
}
