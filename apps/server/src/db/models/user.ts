import type { Locale, Theme } from '@wgm/shared';
import {
  DataTypes,
  literal,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

/**
 * Someone who has logged into the web app with Discord, or who was made Guild Master before
 * their first login (their login finds this record by Discord ID).
 */
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare discordId: string;
  /** Discord display name, refreshed on every login. */
  declare name: string;
  /** Discord avatar hash, refreshed on every login. Null means the default avatar. */
  declare avatar: string | null;
  declare locale: CreationOptional<Locale>;
  /** IANA time zone name. */
  declare timeZone: CreationOptional<string>;
  declare theme: CreationOptional<Theme>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    User.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: literal('uuidv7()') },
        discordId: { type: DataTypes.STRING(20), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(100), allowNull: false },
        avatar: { type: DataTypes.STRING(100), allowNull: true },
        locale: { type: DataTypes.STRING(5), allowNull: false, defaultValue: 'en' },
        timeZone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'UTC' },
        theme: { type: DataTypes.STRING(5), allowNull: false, defaultValue: 'dark' },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'users' },
    );
  }
}
