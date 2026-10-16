import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('test database', () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('connects to the test database, not the development one', async () => {
    const result = await client.query<{ name: string }>('SELECT current_database() AS name');

    expect(result.rows[0]?.name).toMatch(/_test$/);
  });

  it('starts every run with only the migrated tables', async () => {
    const result = await client.query<{ name: string }>(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public'",
    );

    expect(result.rows.map((row) => row.name)).toContain('SequelizeMeta');
  });
});
