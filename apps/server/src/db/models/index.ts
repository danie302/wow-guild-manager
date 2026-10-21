import type { Sequelize } from 'sequelize';

import { Guild } from './guild.js';
import { GuildOfficer } from './guild-officer.js';
import { User } from './user.js';

export { Guild, GuildOfficer, User };

/**
 * Registers every model with the connection, then sets up their associations.
 * Add each new model here (see apps/server/src/db/README.md).
 */
export function initModels(sequelize: Sequelize): void {
  User.initModel(sequelize);
  Guild.initModel(sequelize);
  GuildOfficer.initModel(sequelize);

  Guild.associate();
  GuildOfficer.associate();
}
