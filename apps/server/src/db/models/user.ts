import type { Locale } from '@wgm/shared';
import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

/** Someone who has logged into the web app with Discord. */
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare discordId: string;
  /** Discord display name, refreshed on every login. */
  declare name: string;
  /** Discord avatar hash, refreshed on every login. Null means the default avatar. */
  declare avatar: string | null;
  declare locale: CreationOptional<Locale>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    User.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        discordId: { type: DataTypes.STRING(20), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(100), allowNull: false },
        avatar: { type: DataTypes.STRING(100), allowNull: true },
        locale: { type: DataTypes.STRING(5), allowNull: false, defaultValue: 'en' },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'users' },
    );
  }
}
