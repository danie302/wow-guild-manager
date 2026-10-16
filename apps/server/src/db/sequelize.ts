import { Sequelize } from 'sequelize';

import type { Logger } from '../logger.js';
import { clsNamespace } from './cls.js';
import { initModels } from './models/index.js';

// Every query inside sequelize.transaction(async () => { … }) joins that transaction automatically.
// The sign-up slot lock depends on this. Don't remove it.
Sequelize.useCLS(clsNamespace);

/** Connects to PostgreSQL and registers every model. */
export function createSequelize(databaseUrl: string, logger?: Logger): Sequelize {
  const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: logger ? (sql) => logger.debug({ sql }, 'SQL query') : false,
    define: {
      underscored: true,
    },
  });
  initModels(sequelize);
  return sequelize;
}
