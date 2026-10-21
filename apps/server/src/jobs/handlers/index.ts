import { extendAllSeries } from '../../domain/series.js';
import type { CharacterLookup } from '../../integrations/character-lookup/character-lookup.js';
import type { DirectMessenger } from '../../integrations/discord/direct-messages.js';
import type { Logger } from '../../logger.js';
import type { JobHandlers } from '../worker.js';
import { pingHandler } from './ping.js';
import { registrationHandlers } from './registrations.js';

/** What the handlers can use. Lookups in the game run here, never in page requests. */
export interface JobDependencies {
  logger: Logger;
  characterLookup: CharacterLookup;
  /** Null when the worker has no bot token. */
  messenger: DirectMessenger | null;
}

export function createJobHandlers(dependencies: JobDependencies): JobHandlers {
  return {
    ping: pingHandler(dependencies.logger),
    ...registrationHandlers(dependencies),
    'extend-series': () => extendAllSeries(dependencies.logger),
  };
}
