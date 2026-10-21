import type {
  CharacterClass,
  Faction,
  Locale,
  Race,
  RegistrationLookup,
  RegistrationStatus,
} from '@wgm/shared';
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
import { User } from './user.js';

/** Why a registration was rejected without an Officer. */
export type RegistrationRejectionReason = 'wrong_faction';

/**
 * A character registered from Discord with /register, for an Officer to approve (see
 * domain/registrations.ts). The Discord profile is copied, so approving can add someone who
 * isn't on the roster yet.
 */
export class CharacterRegistration extends Model<
  InferAttributes<CharacterRegistration>,
  InferCreationAttributes<CharacterRegistration>
> {
  declare id: CreationOptional<string>;
  declare guildId: ForeignKey<Guild['id']>;
  declare discordUserId: string;
  declare discordName: string;
  declare discordAvatar: string | null;
  /** The language they used /register in, for the direct message about the result. */
  declare locale: Locale | null;
  declare name: string;
  declare lookup: CreationOptional<RegistrationLookup>;
  /** Filled in when the lookup finds the character. */
  declare faction: CreationOptional<Faction | null>;
  declare race: CreationOptional<Race | null>;
  declare characterClass: CreationOptional<CharacterClass | null>;
  declare level: CreationOptional<number | null>;
  /** When the game data was read. */
  declare lookedUpAt: CreationOptional<Date | null>;
  declare status: CreationOptional<RegistrationStatus>;
  declare rejectionReason: CreationOptional<RegistrationRejectionReason | null>;
  declare reviewedByUserId: CreationOptional<ForeignKey<User['id']> | null>;
  declare reviewedAt: CreationOptional<Date | null>;
  /** The character an approval created. */
  declare characterId: CreationOptional<ForeignKey<Character['id']> | null>;

  declare guild?: NonAttribute<Guild>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    CharacterRegistration.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: literal('uuidv7()') },
        discordUserId: { type: DataTypes.STRING(20), allowNull: false },
        discordName: { type: DataTypes.STRING(100), allowNull: false },
        discordAvatar: { type: DataTypes.STRING(100), allowNull: true },
        locale: { type: DataTypes.STRING(5), allowNull: true },
        name: { type: DataTypes.STRING(64), allowNull: false },
        lookup: { type: DataTypes.STRING(11), allowNull: false, defaultValue: 'pending' },
        faction: { type: DataTypes.STRING(8), allowNull: true },
        race: { type: DataTypes.STRING(16), allowNull: true },
        characterClass: { type: DataTypes.STRING(16), allowNull: true },
        level: { type: DataTypes.SMALLINT, allowNull: true },
        lookedUpAt: { type: DataTypes.DATE, allowNull: true },
        status: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'pending' },
        rejectionReason: { type: DataTypes.STRING(16), allowNull: true },
        reviewedByUserId: { type: DataTypes.UUID, allowNull: true },
        reviewedAt: { type: DataTypes.DATE, allowNull: true },
        characterId: { type: DataTypes.UUID, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'character_registrations' },
    );
  }

  static associate(): void {
    CharacterRegistration.belongsTo(Guild, {
      foreignKey: { name: 'guildId', allowNull: false },
      as: 'guild',
    });
  }
}
