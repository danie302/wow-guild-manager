import { defineConfig } from 'vitest/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testRedisUrl = process.env.TEST_REDIS_URL;

if (!testDatabaseUrl || !testRedisUrl) {
  throw new Error(
    'TEST_DATABASE_URL or TEST_REDIS_URL is not set. Run the server tests inside Docker: docker compose exec api pnpm test',
  );
}

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Test files share the test database and empty its tables, so they run one at a time.
    fileParallelism: false,
    // Server code reads DATABASE_URL and REDIS_URL, so tests point them at the test databases.
    env: {
      DATABASE_URL: testDatabaseUrl,
      REDIS_URL: testRedisUrl,
    },
  },
});
