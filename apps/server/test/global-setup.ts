import pg from 'pg';

/**
 * Recreates the test database before every test run, so each run starts empty.
 * It refuses to run unless the target is clearly a test database.
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
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}
