import {
  DataTypes,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { Guild } from './guild.js';

/**
 * A Discord user with a guild's Officer role in its server. The bot keeps these in step with
 * Discord (see domain/officers.ts). Officer access is read from here.
 */
export class GuildOfficer extends Model<
  InferAttributes<GuildOfficer>,
  InferCreationAttributes<GuildOfficer>
> {
  declare guildId: ForeignKey<Guild['id']>;
  declare discordUserId: string;

  declare createdAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    GuildOfficer.init(
      {
        guildId: { type: DataTypes.UUID, primaryKey: true },
        discordUserId: { type: DataTypes.STRING(20), primaryKey: true },
        createdAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'guild_officers', updatedAt: false },
    );
  }

  static associate(): void {
    GuildOfficer.belongsTo(Guild, { foreignKey: { name: 'guildId', allowNull: false } });
  }
}
