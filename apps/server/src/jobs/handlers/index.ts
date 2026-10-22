import { extendAllSeries } from '../../domain/series.js';
import type { CharacterLookup } from '../../integrations/character-lookup/character-lookup.js';
import type { PostEmojis } from '../../domain/event-post.js';
import { Guild } from '../../db/models/index.js';
import type { ServerExit } from '../../integrations/discord/server-exit.js';
import type { ChannelMessages } from '../../integrations/discord/channel-messages.js';
import type { DirectMessenger } from '../../integrations/discord/direct-messages.js';
import type { Logger } from '../../logger.js';
import { enqueueMissingEventPosts } from '../event-posts.js';
import { scheduleEventJobs } from '../event-jobs.js';
import type { JobEnqueuer } from '../queue.js';
import type { JobHandlers } from '../worker.js';
import { eventPostHandlers } from './event-posts.js';
import { pingHandler } from './ping.js';
import { registrationHandlers } from './registrations.js';
import { signUpNoticeHandlers } from './sign-up-notices.js';
import { missingRoleHandlers } from './missing-roles.js';
import { tentativeHandlers } from './tentative.js';

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
  /** Leaves Discord servers; null when the worker has no bot token. */
  serverExit?: ServerExit | null;
  /** The class and role icons of event posts; without it, the fallback ones. */
  emojis?: () => Promise<PostEmojis>;
}

export function createJobHandlers(dependencies: JobDependencies): JobHandlers {
  return {
    ping: pingHandler(dependencies.logger),
    ...registrationHandlers(dependencies),
    ...eventPostHandlers(dependencies),
    ...signUpNoticeHandlers(dependencies),
    ...tentativeHandlers(dependencies),
    ...missingRoleHandlers(dependencies),
    'leave-server': async ({ discordServerId }) => {
      // A new guild may already use this server again: then the bot stays.
      if (await Guild.count({ where: { discordServerId } })) return;
      if (!dependencies.serverExit) {
        dependencies.logger.warn({ discordServerId }, 'No bot token, so the bot stays');
        return;
      }
      await dependencies.serverExit.leave(discordServerId);
    },
    // New events of a series get their posts in the same run.
    'extend-series': async () => {
      const created = await extendAllSeries(dependencies.logger);
      await scheduleEventJobs(dependencies.jobs, created);
      await enqueueMissingEventPosts(dependencies.jobs);
    },
  };
}
