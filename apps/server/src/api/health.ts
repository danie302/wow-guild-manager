import type { HealthResponse, HealthStatus } from '@wgm/shared';
import { Router } from 'express';
import type pg from 'pg';
import type { RedisClientType } from 'redis';

/** Resolves if the dependency is reachable, rejects otherwise. */
export type HealthCheck = () => Promise<void>;

export type HealthChecks = Record<keyof HealthResponse['checks'], HealthCheck>;

const DEFAULT_TIMEOUT_MS = 2000;

export function postgresCheck(pool: pg.Pool): HealthCheck {
  return async () => {
    await pool.query('SELECT 1');
  };
}

export function redisCheck(client: Pick<RedisClientType, 'isReady' | 'ping'>): HealthCheck {
  return async () => {
    if (!client.isReady) {
      throw new Error('Redis client is not connected');
    }
    await client.ping();
  };
}

export function healthRouter(checks: HealthChecks, timeoutMs = DEFAULT_TIMEOUT_MS): Router {
  const router = Router();

  router.get('/health', async (req, res) => {
    const names = Object.keys(checks) as (keyof HealthChecks)[];
    const results = await Promise.allSettled(
      names.map((name) => withTimeout(checks[name](), timeoutMs)),
    );

    const statuses = {} as Record<keyof HealthChecks, HealthStatus>;
    results.forEach((result, index) => {
      const name = names[index] as keyof HealthChecks;
      statuses[name] = result.status === 'fulfilled' ? 'up' : 'down';
      if (result.status === 'rejected') {
        req.log.warn({ err: result.reason as unknown, check: name }, 'Health check failed');
      }
    });

    const healthy = Object.values(statuses).every((status) => status === 'up');
    const body: HealthResponse = { status: healthy ? 'ok' : 'error', checks: statuses };
    res.status(healthy ? 200 : 503).json(body);
  });

  return router;
}

async function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
  });
  try {
    await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
