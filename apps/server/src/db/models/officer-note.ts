import {
  DataTypes,
  literal,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { Member } from './member.js';
import { User } from './user.js';

/** A private note about a member, written by the Guild Master or an Officer. */
export class OfficerNote extends Model<
  InferAttributes<OfficerNote>,
  InferCreationAttributes<OfficerNote>
> {
  declare id: CreationOptional<string>;
  declare memberId: ForeignKey<Member['id']>;
  /** Null when the author's account no longer exists. */
  declare authorUserId: ForeignKey<User['id']> | null;
  declare text: string;

  declare createdAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    OfficerNote.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: literal('uuidv7()') },
        text: { type: DataTypes.TEXT, allowNull: false },
        createdAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'officer_notes', updatedAt: false },
    );
  }

  static associate(): void {
    OfficerNote.belongsTo(Member, { foreignKey: { name: 'memberId', allowNull: false } });
    OfficerNote.belongsTo(User, { foreignKey: 'authorUserId', as: 'author' });
  }
}
