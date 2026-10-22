import { Event, Guild } from '../../db/models/index.js';
import { missingRoleAlert, missingRoles } from '../../domain/missing-roles.js';
import {
  ChannelMessageError,
  type ChannelMessages,
} from '../../integrations/discord/channel-messages.js';
import type { Logger } from '../../logger.js';
import type { JobPayloads } from '../definitions.js';

export interface MissingRoleJobDependencies {
  logger: Logger;
  /** Null when the worker has no bot token: alerts aren't posted then. */
  channelMessages: ChannelMessages | null;
}

const HOUR = 60 * 60 * 1000;
/** How early a check may run: queues aren't exact. */
const TOLERANCE = 60 * 1000;

export function missingRoleHandlers({ logger, channelMessages }: MissingRoleJobDependencies) {
  return {
    /**
     * Posts the alert if the event is still missing players. Does nothing for a cancelled or
     * started event, a check whose time moved later (the event moved), or the 48-hour check
     * when the 24-hour one is already due (the worker was down), so a late job never alerts
     * twice.
     */
    'missing-role-check': async ({ eventId, hoursBefore }: JobPayloads['missing-role-check']) => {
      if (!channelMessages) {
        logger.warn({ eventId }, 'No bot token, so no missing-role alert');
        return;
      }
      const now = Date.now();
      const event = await Event.findByPk(eventId, { include: [{ model: Guild, as: 'guild' }] });
      const guild = event?.guild;
      if (!event || !guild?.eventsChannelId || event.cancelledAt) return;
      const start = event.startsAt.getTime();
      if (start <= now || now < start - hoursBefore * HOUR - TOLERANCE) return;
      if (hoursBefore === 48 && now >= start - 24 * HOUR) return;

      const roles = await missingRoles(event, guild);
      if (roles.length === 0) return;
      const { content, mentions } = missingRoleAlert(event, guild.discordLocale, roles);
      const onPost = event.discordChannelId === guild.eventsChannelId && event.discordMessageId;
      try {
        await channelMessages.post(guild.eventsChannelId, {
          content,
          mentionUserIds: mentions,
          ...(onPost && { replyTo: event.discordMessageId! }),
        });
      } catch (err) {
        if (!(err instanceof ChannelMessageError)) throw err;
        logger.warn({ eventId, reason: err.reason }, 'Discord refused the missing-role alert');
      }
    },
  };
}
