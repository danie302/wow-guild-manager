import type { Locale, RegistrationStatus } from '@wgm/shared';
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

/**
 * A request to join a guild's roster, made from Discord with /register, for the Guild Master
 * or an Officer to approve (see domain/registrations.ts). The Discord profile is copied, so
 * approving can add someone who isn't on the roster yet.
 */
export class Registration extends Model<
  InferAttributes<Registration>,
  InferCreationAttributes<Registration>
> {
  declare id: CreationOptional<string>;
  declare guildId: ForeignKey<Guild['id']>;
  declare discordUserId: string;
  declare discordName: string;
  declare discordAvatar: string | null;
  /** The language they used /register in, for the direct message about the result. */
  declare locale: Locale | null;
  declare status: CreationOptional<RegistrationStatus>;
  /** Null when the reviewer's account no longer exists. */
  declare reviewedByUserId: CreationOptional<ForeignKey<User['id']> | null>;
  declare reviewedAt: CreationOptional<Date | null>;
  /** When they left the guild's Discord server; null while they're in it (see domain/presence.ts). */
  declare leftDiscordAt: CreationOptional<Date | null>;

  declare guild?: NonAttribute<Guild>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    Registration.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: literal('uuidv7()') },
        discordUserId: { type: DataTypes.STRING(20), allowNull: false },
        discordName: { type: DataTypes.STRING(100), allowNull: false },
        discordAvatar: { type: DataTypes.STRING(100), allowNull: true },
        locale: { type: DataTypes.STRING(5), allowNull: true },
        status: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'pending' },
        reviewedByUserId: { type: DataTypes.UUID, allowNull: true },
        reviewedAt: { type: DataTypes.DATE, allowNull: true },
        leftDiscordAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'registrations' },
    );
  }

  static associate(): void {
    Registration.belongsTo(Guild, {
      foreignKey: { name: 'guildId', allowNull: false },
      as: 'guild',
    });
  }
}
