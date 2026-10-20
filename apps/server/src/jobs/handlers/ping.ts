import type { Logger } from '../../logger.js';
import type { JobPayloads } from '../definitions.js';

export function pingHandler(logger: Logger) {
  return ({ message }: JobPayloads['ping']): void => {
    logger.info({ message }, 'Ping job ran');
  };
}
