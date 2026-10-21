import type { Rank } from '@wgm/shared';
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

/**
 * One entry of a member's rank history. `source` is "app" for changes made in the web app (by
 * `changedByUserId`) and "discord" for gaining or losing the Officer role in Discord.
 */
export class RankChange extends Model<
  InferAttributes<RankChange>,
  InferCreationAttributes<RankChange>
> {
  declare id: CreationOptional<string>;
  declare memberId: ForeignKey<Member['id']>;
  /** Null for the first entry, when the member joined the roster. */
  declare fromRank: Rank | null;
  declare toRank: Rank;
  declare changedByUserId: ForeignKey<User['id']> | null;
  declare source: 'app' | 'discord';

  declare createdAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    RankChange.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: literal('uuidv7()') },
        fromRank: { type: DataTypes.STRING(12), allowNull: true },
        toRank: { type: DataTypes.STRING(12), allowNull: false },
        source: { type: DataTypes.STRING(7), allowNull: false },
        createdAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'rank_changes', updatedAt: false },
    );
  }

  static associate(): void {
    RankChange.belongsTo(Member, { foreignKey: { name: 'memberId', allowNull: false } });
    RankChange.belongsTo(User, { foreignKey: 'changedByUserId', as: 'changedBy' });
  }
}
