import type { CharacterClass, Faction, Profession, Race } from '@wgm/shared';
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

import { Member } from './member.js';

/**
 * A character of a member. Names are unique among active characters across the game. A
 * removed character keeps its row, so past sign-ups and attendance still point at it.
 */
export class Character extends Model<
  InferAttributes<Character>,
  InferCreationAttributes<Character>
> {
  declare id: CreationOptional<string>;
  declare memberId: ForeignKey<Member['id']>;
  declare name: string;
  declare faction: Faction;
  declare race: Race;
  declare characterClass: CharacterClass;
  declare level: number;
  declare professions: Profession[];
  /** Each member with characters has exactly one main. */
  declare isMain: CreationOptional<boolean>;
  declare removedAt: CreationOptional<Date | null>;

  declare member?: NonAttribute<Member>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    Character.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: literal('uuidv7()') },
        name: { type: DataTypes.STRING(64), allowNull: false },
        faction: { type: DataTypes.STRING(8), allowNull: false },
        race: { type: DataTypes.STRING(16), allowNull: false },
        characterClass: { type: DataTypes.STRING(16), allowNull: false },
        level: { type: DataTypes.SMALLINT, allowNull: false },
        professions: { type: DataTypes.ARRAY(DataTypes.STRING(16)), allowNull: false },
        isMain: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        removedAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'characters' },
    );
  }

  static associate(): void {
    Character.belongsTo(Member, {
      foreignKey: { name: 'memberId', allowNull: false },
      as: 'member',
    });
  }
}
