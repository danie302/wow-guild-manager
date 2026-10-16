import { createClient } from 'redis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { createSequelize } from '../db/sequelize.js';
import { databaseCheck, redisCheck, type HealthCheck } from './health.js';
import { createTestLogger } from './test-logger.js';

const up: HealthCheck = () => Promise.resolve();
const down: HealthCheck = () => Promise.reject(new Error('connection refused'));

function appWith(database: HealthCheck, redis: HealthCheck) {
  return createApp({ logger: createTestLogger().logger, healthChecks: { database, redis } });
}

describe('GET /api/health', () => {
  describe('with the real PostgreSQL and Redis', () => {
    const sequelize = createSequelize(process.env.DATABASE_URL ?? '');
    const redis = createClient({ url: process.env.REDIS_URL, disableOfflineQueue: true });

    beforeAll(async () => {
      await redis.connect();
    });

    afterAll(async () => {
      await Promise.all([sequelize.close(), redis.close()]);
    });

    it('returns 200 when both are up', async () => {
      const response = await request(appWith(databaseCheck(sequelize), redisCheck(redis))).get(
        '/api/health',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', checks: { database: 'up', redis: 'up' } });
    });
  });

  it('returns 503 and names the database when PostgreSQL is down', async () => {
    const response = await request(appWith(down, up)).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'error', checks: { database: 'down', redis: 'up' } });
  });

  it('returns 503 and names Redis when Redis is down', async () => {
    const response = await request(appWith(up, down)).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'error', checks: { database: 'up', redis: 'down' } });
  });

  it('reports a disconnected Redis client as down', async () => {
    const disconnected = redisCheck({ isReady: false, ping: () => Promise.resolve('PONG') });

    const response = await request(appWith(up, disconnected)).get('/api/health');

    expect(response.body).toMatchObject({ checks: { redis: 'down' } });
  });
});
