import { describe, expect, it } from 'vitest';

import { apiConfigSchema, botConfigSchema, ConfigError, loadConfig } from './config.js';

const baseEnv = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('loadConfig', () => {
  it('applies defaults for optional variables', () => {
    expect(loadConfig(apiConfigSchema, baseEnv)).toEqual({
      ...baseEnv,
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
    });
  });

  it('names a missing required variable', () => {
    const env = { REDIS_URL: baseEnv.REDIS_URL };

    expect(() => loadConfig(apiConfigSchema, env)).toThrow(ConfigError);
    expect(() => loadConfig(apiConfigSchema, env)).toThrow('DATABASE_URL is required');
  });

  it('treats an empty variable as missing', () => {
    expect(() => loadConfig(apiConfigSchema, { ...baseEnv, REDIS_URL: '' })).toThrow(
      'REDIS_URL is required',
    );
  });

  it('names an invalid variable', () => {
    expect(() => loadConfig(apiConfigSchema, { ...baseEnv, PORT: 'abc' })).toThrow(/PORT:/);
  });

  it('requires the bot token for the bot', () => {
    expect(() => loadConfig(botConfigSchema, baseEnv)).toThrow('DISCORD_BOT_TOKEN is required');
    expect(loadConfig(botConfigSchema, { ...baseEnv, DISCORD_BOT_TOKEN: 'token' })).toMatchObject({
      DISCORD_BOT_TOKEN: 'token',
    });
  });
});
