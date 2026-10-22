import type { CombatRole, SignUpPlacement, SignUpStatus } from '@wgm/shared';
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
import { Event } from './event.js';
import { Member } from './member.js';

/** A member's sign-up for an event, with one of their characters (see domain/sign-ups.ts). */
export class SignUp extends Model<InferAttributes<SignUp>, InferCreationAttributes<SignUp>> {
  declare id: CreationOptional<string>;
  declare eventId: ForeignKey<Event['id']>;
  declare memberId: ForeignKey<Member['id']>;
  declare characterId: ForeignKey<Character['id']>;
  /** Null only for a Declined sign-up that never had a role. */
  declare role: CombatRole | null;
  declare status: SignUpStatus;
  /** Null when Declined. */
  declare placement: SignUpPlacement | null;
  /** When they signed up for this role: the waitlist's order. */
  declare signedUpAt: Date;

  declare event?: NonAttribute<Event>;
  declare character?: NonAttribute<Character>;
  declare member?: NonAttribute<Member>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    SignUp.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: literal('uuidv7()') },
        role: { type: DataTypes.STRING(6), allowNull: true },
        status: { type: DataTypes.STRING(9), allowNull: false },
        placement: { type: DataTypes.STRING(8), allowNull: true },
        signedUpAt: { type: DataTypes.DATE, allowNull: false },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'sign_ups' },
    );
  }

  static associate(): void {
    SignUp.belongsTo(Event, { foreignKey: { name: 'eventId', allowNull: false }, as: 'event' });
    SignUp.belongsTo(Member, { foreignKey: { name: 'memberId', allowNull: false }, as: 'member' });
    SignUp.belongsTo(Character, {
      foreignKey: { name: 'characterId', allowNull: false },
      as: 'character',
    });
    Event.hasMany(SignUp, { foreignKey: 'eventId', as: 'signUps' });
  }
}
