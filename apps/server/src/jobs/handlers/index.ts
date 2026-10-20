import type { Logger } from '../../logger.js';
import type { JobHandlers } from '../worker.js';
import { pingHandler } from './ping.js';

export function createJobHandlers(logger: Logger): JobHandlers {
  return {
    ping: pingHandler(logger),
  };
}
