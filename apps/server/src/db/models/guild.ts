import type { Faction } from '@wgm/shared';
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

import { User } from './user.js';

/** A guild, connected to one Discord server. */
export class Guild extends Model<InferAttributes<Guild>, InferCreationAttributes<Guild>> {
  declare id: CreationOptional<string>;
  declare name: string;
  /** Only characters of this faction can be on the roster. */
  declare faction: Faction;
  /** The connected Discord server. A server is connected to at most one guild. */
  declare discordServerId: string;
  /** The Discord role whose members are Officers. */
  declare officerRoleId: string;
  /** A user leads at most one guild at a time (a unique index). */
  declare guildMasterUserId: ForeignKey<User['id']>;
  /** The image's key in file storage, or null when the guild has none. */
  declare imageKey: CreationOptional<string | null>;

  declare guildMaster?: NonAttribute<User>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    Guild.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: literal('uuidv7()') },
        name: { type: DataTypes.STRING(50), allowNull: false },
        faction: { type: DataTypes.STRING(8), allowNull: false },
        discordServerId: { type: DataTypes.STRING(20), allowNull: false, unique: true },
        officerRoleId: { type: DataTypes.STRING(20), allowNull: false },
        imageKey: { type: DataTypes.STRING(100), allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'guilds' },
    );
  }

  static associate(): void {
    Guild.belongsTo(User, {
      foreignKey: { name: 'guildMasterUserId', allowNull: false },
      as: 'guildMaster',
    });
  }
}
