import type { Sequelize } from 'sequelize';

import { Character } from './character.js';
import { Event } from './event.js';
import { EventSeries } from './event-series.js';
import { Guild } from './guild.js';
import { GuildOfficer } from './guild-officer.js';
import { Member } from './member.js';
import { OfficerNote } from './officer-note.js';
import { RankChange } from './rank-change.js';
import { Registration } from './registration.js';
import { User } from './user.js';

export {
  Character,
  Event,
  EventSeries,
  Guild,
  GuildOfficer,
  Member,
  OfficerNote,
  RankChange,
  Registration,
  User,
};

/**
 * Registers every model with the connection, then sets up their associations.
 * Add each new model here (see apps/server/src/db/README.md).
 */
export function initModels(sequelize: Sequelize): void {
  User.initModel(sequelize);
  Guild.initModel(sequelize);
  GuildOfficer.initModel(sequelize);
  Member.initModel(sequelize);
  Character.initModel(sequelize);
  RankChange.initModel(sequelize);
  OfficerNote.initModel(sequelize);
  Registration.initModel(sequelize);
  Event.initModel(sequelize);
  EventSeries.initModel(sequelize);

  Guild.associate();
  GuildOfficer.associate();
  Member.associate();
  Character.associate();
  RankChange.associate();
  OfficerNote.associate();
  Registration.associate();
  Event.associate();
  EventSeries.associate();
}
