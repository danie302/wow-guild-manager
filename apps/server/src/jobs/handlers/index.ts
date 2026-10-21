import { extendAllSeries } from '../../domain/series.js';
import type { CharacterLookup } from '../../integrations/character-lookup/character-lookup.js';
import type { ChannelMessages } from '../../integrations/discord/channel-messages.js';
import type { DirectMessenger } from '../../integrations/discord/direct-messages.js';
import type { Logger } from '../../logger.js';
import { enqueueMissingEventPosts } from '../event-posts.js';
import type { JobEnqueuer } from '../queue.js';
import type { JobHandlers } from '../worker.js';
import { eventPostHandlers } from './event-posts.js';
import { pingHandler } from './ping.js';
import { registrationHandlers } from './registrations.js';

/** What the handlers can use. Lookups in the game run here, never in page requests. */
export interface JobDependencies {
  logger: Logger;
  characterLookup: CharacterLookup;
  /** Null when the worker has no bot token. */
  messenger: DirectMessenger | null;
  /** Posts in server channels; null when the worker has no bot token. */
  channelMessages: ChannelMessages | null;
  /** For jobs that add other jobs. */
  jobs: JobEnqueuer;
}

export function createJobHandlers(dependencies: JobDependencies): JobHandlers {
  return {
    ping: pingHandler(dependencies.logger),
    ...registrationHandlers(dependencies),
    ...eventPostHandlers(dependencies),
    // New events of a series get their posts in the same run.
    'extend-series': async () => {
      await extendAllSeries(dependencies.logger);
      await enqueueMissingEventPosts(dependencies.jobs);
    },
  };
}
