import type { CharacterLookup } from '../../integrations/character-lookup/character-lookup.js';
import type { Logger } from '../../logger.js';
import type { JobHandlers } from '../worker.js';
import { pingHandler } from './ping.js';

/** What the handlers can use. Lookups in the game run here, never in page requests. */
export interface JobDependencies {
  logger: Logger;
  characterLookup: CharacterLookup;
}

export function createJobHandlers({ logger }: JobDependencies): JobHandlers {
  return {
    ping: pingHandler(logger),
  };
}
