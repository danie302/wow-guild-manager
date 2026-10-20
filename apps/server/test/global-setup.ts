import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { createClient } from 'redis';

const serverDir = fileURLToPath(new URL('..', import.meta.url));

/**
 * Recreates the test database before every test run and runs the migrations, and empties the
 * test Redis database, so each run starts with the current schema and no data. It refuses to
 * run unless the targets are clearly test databases.
 */
export default async function setup(): Promise<void> {
  await resetDatabase();
  await resetRedis();
}

async function resetDatabase(): Promise<void> {
  const testUrl = new URL(requireEnv('TEST_DATABASE_URL'));
  const testDatabase = testUrl.pathname.slice(1);
  const devDatabase = process.env.POSTGRES_DB;

  if (!testDatabase.endsWith('_test') || testDatabase === devDatabase) {
    throw new Error(
      `Refusing to reset "${testDatabase}": the test database name must end in "_test" and differ from the development database.`,
    );
  }

  // Connect to the maintenance database, because a database can't drop itself.
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  const client = new pg.Client({ connectionString: adminUrl.toString() });

  await client.connect();
  try {
    const name = client.escapeIdentifier(testDatabase);
    await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${name}`);
  } finally {
    await client.end();
  }

  execFileSync('node_modules/.bin/sequelize-cli', ['db:migrate'], {
    cwd: serverDir,
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: testUrl.toString() },
    stdio: 'pipe',
  });
}

async function resetRedis(): Promise<void> {
  const url = new URL(requireEnv('TEST_REDIS_URL'));
  const database = Number(url.pathname.slice(1) || '0');

  // The app uses Redis database 0, so the tests must use another one.
  if (!(database > 0)) {
    throw new Error(
      `Refusing to empty Redis database ${database}: the tests must use a database other than 0.`,
    );
  }

  const client = createClient({ url: url.toString() });
  await client.connect();
  try {
    await client.flushDb();
  } finally {
    await client.close();
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}
