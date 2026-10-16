import { defineConfig } from 'vitest/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Run the server tests inside Docker: docker compose exec api pnpm test',
  );
}

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Server code reads DATABASE_URL, so tests point it at the test database.
    env: {
      DATABASE_URL: testDatabaseUrl,
    },
  },
});
