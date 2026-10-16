import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const serverDir = fileURLToPath(new URL('..', import.meta.url));

/**
 * Recreates the test database before every test run and runs the migrations, so each run
 * starts with the current schema and no data. It refuses to run unless the target is clearly
 * a test database.
 */
export default async function setup(): Promise<void> {
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}
