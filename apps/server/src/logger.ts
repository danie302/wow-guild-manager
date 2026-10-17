import { pino, type Logger } from 'pino';

import type { BaseConfig } from './config.js';

export type { Logger };

export function createLogger(config: Pick<BaseConfig, 'NODE_ENV' | 'LOG_LEVEL'>): Logger {
  return pino({
    level: config.LOG_LEVEL,
    // Readable logs in development; JSON everywhere else.
    ...(config.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
  });
}
