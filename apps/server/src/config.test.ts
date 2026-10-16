import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig } from './config.js';

const validEnv = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('loadConfig', () => {
  it('applies defaults for optional variables', () => {
    expect(loadConfig(validEnv)).toEqual({
      ...validEnv,
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
    });
  });

  it('names a missing required variable', () => {
    expect(() => loadConfig({ REDIS_URL: validEnv.REDIS_URL })).toThrow(ConfigError);
    expect(() => loadConfig({ REDIS_URL: validEnv.REDIS_URL })).toThrow('DATABASE_URL is required');
  });

  it('treats an empty variable as missing', () => {
    expect(() => loadConfig({ ...validEnv, REDIS_URL: '' })).toThrow('REDIS_URL is required');
  });

  it('names an invalid variable', () => {
    expect(() => loadConfig({ ...validEnv, PORT: 'abc' })).toThrow(/PORT:/);
  });
});
