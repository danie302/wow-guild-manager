import { Events, type Client, type Guild as DiscordServer } from 'discord.js';

import { Guild } from '../db/models/index.js';
import {
  removeServer,
  removeServerMember,
  removeServerRole,
  replaceGuildOfficers,
  updateServerMember,
} from '../domain/officers.js';
import type { Logger } from '../logger.js';

/**
 * Keeps `guild_officers` in step with the Officer role in Discord. Role changes arrive as
 * Gateway events, which cost no Discord API calls. Each time the bot connects (or reconnects
 * with a new session, when events may have been missed) it reads every server's members again.
 */
export function syncOfficers(client: Client, logger: Logger): void {
  const run = (what: string, work: () => Promise<void>) => {
    work().catch((err: unknown) => logger.error({ err }, `Could not update Officers: ${what}`));
  };

  client.on(Events.ShardReady, () => {
    run('resync', () => resyncAllOfficers(client, logger));
  });
  client.on(Events.GuildMemberUpdate, (_old, member) => {
    run('member update', () =>
      updateServerMember(member.guild.id, member.id, [...member.roles.cache.keys()]),
    );
  });
  client.on(Events.GuildMemberAdd, (member) => {
    run('member join', () =>
      updateServerMember(member.guild.id, member.id, [...member.roles.cache.keys()]),
    );
  });
  client.on(Events.GuildMemberRemove, (member) => {
    run('member leave', () => removeServerMember(member.guild.id, member.id));
  });
  client.on(Events.GuildRoleDelete, (role) => {
    run('role delete', () => removeServerRole(role.guild.id, role.id));
  });
  client.on(Events.GuildDelete, (server) => {
    run('bot removed', () => removeServer(server.id));
  });
}

/** Reads the members of every connected server and replaces each guild's Officers. */
export async function resyncAllOfficers(
  client: Pick<Client, 'guilds'>,
  logger: Logger,
): Promise<void> {
  for (const guild of await Guild.findAll()) {
    const server = client.guilds.cache.get(guild.discordServerId);
    try {
      await replaceGuildOfficers(guild.id, server ? await officerIds(server, guild) : []);
    } catch (err) {
      logger.error({ err, guildId: guild.id }, 'Could not resync Officers');
    }
  }
  logger.info('Officers resynced');
}

async function officerIds(server: DiscordServer, guild: Guild): Promise<string[]> {
  // Fetching the member list goes over the Gateway (with the GuildMembers intent), not REST.
  const members = await server.members.fetch();
  return [...members.filter((member) => member.roles.cache.has(guild.officerRoleId)).keys()];
}
