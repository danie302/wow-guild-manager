import express from 'express';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { errorHandler } from './errors.js';
import { createTestLogger } from '../test-logger.js';

const up = () => Promise.resolve();

describe('error responses', () => {
  it('returns a 404 JSON response for unknown routes', async () => {
    const app = createApp({
      logger: createTestLogger().logger,
      healthChecks: { database: up, redis: up },
    });

    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND' } });
  });

  it('returns 400 for a malformed JSON body', async () => {
    const app = createApp({
      logger: createTestLogger().logger,
      healthChecks: { database: up, redis: up },
    });

    const response = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{not json');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: 'INVALID_JSON' } });
  });

  it('returns a 500 JSON response without the stack, and logs the stack', async () => {
    const { logger, lines } = createTestLogger();
    const app = express();
    app.use(pinoHttp({ logger }));
    app.get('/boom', () => {
      throw new Error('Something broke');
    });
    app.use(errorHandler);

    const response = await request(app).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: 'INTERNAL_ERROR' } });
    expect(response.text).not.toContain('Something broke');

    const logged = lines().find((line) => line.msg === 'Unhandled error');
    expect(logged?.err).toMatchObject({
      message: 'Something broke',
      stack: expect.stringContaining('Error: Something broke') as unknown,
    });
  });
});
