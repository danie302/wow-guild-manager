import { Events, type Client } from 'discord.js';

import { updateDiscordProfile } from '../domain/roster.js';
import type { Logger } from '../logger.js';

/** Keeps roster members' Discord names and avatars current, from the bot's events. */
export function syncMemberProfiles(client: Pick<Client, 'on'>, logger: Logger): void {
  client.on(Events.GuildMemberUpdate, (_old, member) => {
    updateDiscordProfile({
      discordUserId: member.id,
      discordName: member.displayName,
      discordAvatar: member.user.avatar,
    }).catch((err: unknown) => logger.error({ err }, 'Could not update a member profile'));
  });
}
