import type { BaseRank, Locale } from '@wgm/shared';
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
import { Guild } from './guild.js';

/**
 * A Discord user on a guild's roster. The same Discord user can be a member of several guilds,
 * with one record in each. Removing a member only sets `removedAt` (see domain/roster.ts).
 */
export class Member extends Model<InferAttributes<Member>, InferCreationAttributes<Member>> {
  declare id: CreationOptional<string>;
  declare guildId: ForeignKey<Guild['id']>;
  declare discordUserId: string;
  /** The Discord display name and avatar hash, kept current by the bot. */
  declare discordName: string;
  declare discordAvatar: string | null;
  /** Raider or Member. Guild Master and Officer are worked out (see domain/ranks.ts). */
  declare rank: BaseRank;
  /** The language of their most recent interaction with the bot, used for DMs. */
  declare locale: CreationOptional<Locale | null>;
  declare removedAt: CreationOptional<Date | null>;
  /** When they left the guild's Discord server; null while they're in it (see domain/presence.ts). */
  declare leftDiscordAt: CreationOptional<Date | null>;

  declare guild?: NonAttribute<Guild>;
  declare characters?: NonAttribute<Character[]>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    Member.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: literal('uuidv7()') },
        discordUserId: { type: DataTypes.STRING(20), allowNull: false },
        discordName: { type: DataTypes.STRING(100), allowNull: false },
        discordAvatar: { type: DataTypes.STRING(100), allowNull: true },
        rank: { type: DataTypes.STRING(6), allowNull: false },
        locale: { type: DataTypes.STRING(5), allowNull: true },
        removedAt: { type: DataTypes.DATE, allowNull: true },
        leftDiscordAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'members' },
    );
  }

  static associate(): void {
    Member.belongsTo(Guild, { foreignKey: { name: 'guildId', allowNull: false }, as: 'guild' });
    Member.hasMany(Character, {
      foreignKey: { name: 'memberId', allowNull: false },
      as: 'characters',
    });
  }
}
