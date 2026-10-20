import type { Sequelize } from 'sequelize';

import { User } from './user.js';

export { User };

/**
 * Registers every model with the connection, then sets up their associations.
 * Add each new model here (see apps/server/src/db/README.md).
 */
export function initModels(sequelize: Sequelize): void {
  User.initModel(sequelize);
}
