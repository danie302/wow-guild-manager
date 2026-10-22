import type { DiscordPostError, EventType } from '@wgm/shared';
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

import { EventSeries } from './event-series.js';
import { Guild } from './guild.js';
import type { SignUp } from './sign-up.js';
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
  /** The weekly series it belongs to, if any. */
  declare seriesId: CreationOptional<ForeignKey<EventSeries['id']> | null>;
  /** Its own Tentative deadline in hours before the start; null uses the guild's. */
  declare tentativeDeadlineHours: CreationOptional<number | null>;
  /** When Tentative participants must have confirmed (see domain/tentative.ts). */
  declare tentativeDeadlineAt: Date;
  /** Its Discord post; null until the worker posts it (jobs/handlers/event-posts.ts). */
  declare discordChannelId: CreationOptional<string | null>;
  declare discordMessageId: CreationOptional<string | null>;
  /** Why the worker couldn't post or update it last time; null when it could. */
  declare discordPostError: CreationOptional<DiscordPostError | null>;

  declare guild?: NonAttribute<Guild>;
  declare createdBy?: NonAttribute<User | null>;
  declare cancelledBy?: NonAttribute<User | null>;
  declare series?: NonAttribute<EventSeries | null>;
  declare signUps?: NonAttribute<SignUp[]>;

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
        seriesId: { type: DataTypes.UUID, allowNull: true },
        tentativeDeadlineHours: { type: DataTypes.SMALLINT, allowNull: true },
        tentativeDeadlineAt: { type: DataTypes.DATE, allowNull: false },
        discordChannelId: { type: DataTypes.STRING(20), allowNull: true },
        discordMessageId: { type: DataTypes.STRING(20), allowNull: true },
        discordPostError: { type: DataTypes.STRING(30), allowNull: true },
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
    Event.belongsTo(EventSeries, { foreignKey: 'seriesId', as: 'series' });
  }
}
