import { Event, EventSeries, Guild } from '../../db/models/index.js';
import { eventChannelId } from '../../domain/event-channel.js';
import { missingRoleAlert, missingRoleCheckAt, missingRoles } from '../../domain/missing-roles.js';
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

/** How early a check may run: queues aren't exact. */
const TOLERANCE = 60 * 1000;

export function missingRoleHandlers({ logger, channelMessages }: MissingRoleJobDependencies) {
  return {
    /**
     * Posts the alert if the event is still missing players. Does nothing for a cancelled or
     * started event, or a check whose time moved later (the event or its alert time changed).
     */
    'missing-role-check': async (payload: JobPayloads['missing-role-check']) => {
      const { eventId } = payload;
      // A check queued before there was one per event (the 48- and 24-hour ones) does nothing.
      if ('hoursBefore' in payload) return;
      if (!channelMessages) {
        logger.warn({ eventId }, 'No bot token, so no missing-role alert');
        return;
      }
      const now = Date.now();
      const event = await Event.findByPk(eventId, {
        include: [
          { model: Guild, as: 'guild' },
          { model: EventSeries, as: 'series', attributes: ['channelId'] },
        ],
      });
      const guild = event?.guild;
      if (!event || !guild || event.cancelledAt) return;
      const channelId = eventChannelId(guild, event.type, event.series?.channelId);
      if (!channelId) return;
      if (event.startsAt.getTime() <= now) return;
      if (now < missingRoleCheckAt(event).getTime() - TOLERANCE) return;

      const roles = await missingRoles(event);
      if (roles.length === 0) return;
      const { content, mentionRoleIds } = missingRoleAlert(
        event,
        guild.discordLocale,
        roles,
        guild.memberRoleId,
      );
      // A reply to the post, in the post's channel.
      const onPost = event.discordChannelId === channelId && event.discordMessageId;
      try {
        await channelMessages.post(channelId, {
          content,
          mentionRoleIds,
          ...(onPost && { replyTo: event.discordMessageId! }),
        });
      } catch (err) {
        if (!(err instanceof ChannelMessageError)) throw err;
        logger.warn({ eventId, reason: err.reason }, 'Discord refused the missing-role alert');
      }
    },
  };
}
