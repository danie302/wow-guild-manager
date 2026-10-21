import { Events, type Client } from 'discord.js';

import { enqueueFailedEventPosts } from '../jobs/event-posts.js';
import type { JobEnqueuer } from '../jobs/index.js';
import type { Logger } from '../logger.js';

/**
 * Retries failed event posts as soon as the bot may have its permissions back: a channel's
 * permissions or a role changed, or the bot got a new role. Gateway events cost no Discord API
 * calls. Each time the bot connects (or reconnects with a new session, when events may have
 * been missed) it retries the failed posts of every server it's in.
 */
export function retryFailedPosts(
  client: Pick<Client, 'on' | 'user' | 'guilds'>,
  jobs: JobEnqueuer,
  logger: Logger,
): void {
  const retry = (serverId: string | string[]) => {
    enqueueFailedEventPosts(jobs, serverId).catch((err: unknown) =>
      logger.warn({ err, serverId }, 'Could not retry the failed event posts'),
    );
  };

  client.on(Events.ShardReady, () => {
    retry([...client.guilds.cache.keys()]);
  });
  client.on(Events.ChannelUpdate, (_old, channel) => {
    if (!channel.isDMBased()) retry(channel.guild.id);
  });
  client.on(Events.GuildRoleUpdate, (_old, role) => {
    retry(role.guild.id);
  });
  client.on(Events.GuildMemberUpdate, (_old, member) => {
    if (member.id === client.user?.id) retry(member.guild.id);
  });
}
