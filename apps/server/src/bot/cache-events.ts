import { Events, type Client } from 'discord.js';

import type { DiscordCacheInvalidator } from '../integrations/discord/cached-directory.js';
import type { Logger } from '../logger.js';

/**
 * Keeps the API's cached Discord data in step with Discord. When a member's roles change (or
 * they join or leave), or a server's roles or channels change, the cached entry is dropped, so the next
 * request re-reads it: removing the Officer role removes app access right away.
 */
export function watchDiscordChanges(
  client: Pick<Client, 'on'>,
  cache: DiscordCacheInvalidator,
  logger: Logger,
): void {
  const forget = (work: Promise<void>) => {
    work.catch((err: unknown) => logger.warn({ err }, 'Could not clear cached Discord data'));
  };

  client.on(Events.GuildMemberUpdate, (_old, member) => {
    forget(cache.forgetMember(member.guild.id, member.id));
  });
  client.on(Events.GuildMemberAdd, (member) => {
    forget(cache.forgetMember(member.guild.id, member.id));
  });
  client.on(Events.GuildMemberRemove, (member) => {
    forget(cache.forgetMember(member.guild.id, member.id));
  });
  client.on(Events.GuildRoleCreate, (role) => {
    forget(cache.forgetServer(role.guild.id));
  });
  client.on(Events.GuildRoleUpdate, (_old, role) => {
    forget(cache.forgetServer(role.guild.id));
  });
  client.on(Events.GuildRoleDelete, (role) => {
    forget(cache.forgetServer(role.guild.id));
  });
  client.on(Events.GuildUpdate, (_old, server) => {
    forget(cache.forgetServer(server.id));
  });
  client.on(Events.GuildDelete, (server) => {
    forget(cache.forgetServer(server.id));
    forget(cache.forgetChannels(server.id));
  });
  // The events channel picker lists channels by the bot's permissions in them.
  client.on(Events.ChannelCreate, (channel) => {
    forget(cache.forgetChannels(channel.guild.id));
  });
  client.on(Events.ChannelUpdate, (_old, channel) => {
    if (!channel.isDMBased()) forget(cache.forgetChannels(channel.guild.id));
  });
  client.on(Events.ChannelDelete, (channel) => {
    if (!channel.isDMBased()) forget(cache.forgetChannels(channel.guild.id));
  });
}
