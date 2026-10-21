import { Events, type Client, type Guild as DiscordServer } from 'discord.js';

import { Guild } from '../db/models/index.js';
import {
  removeServer,
  removeServerMember,
  removeServerRole,
  replaceGuildOfficers,
  updateServerMember,
} from '../domain/officers.js';
import { markLeftDiscord, markRejoinedDiscord, syncPresence } from '../domain/presence.js';
import type { Logger } from '../logger.js';

/**
 * Keeps the database in step with each guild's Discord server: `guild_officers` with the
 * Officer role, and the "left Discord" flag with who is in the server (domain/presence.ts).
 * Changes arrive as Gateway events, which cost no Discord API calls. Each time the bot connects
 * (or reconnects with a new session, when events may have been missed) it reads every server's
 * members again.
 */
export function syncServerMembers(client: Client, logger: Logger): void {
  const run = (what: string, work: () => Promise<void>) => {
    work().catch((err: unknown) => logger.error({ err }, `Could not sync the server: ${what}`));
  };

  client.on(Events.ShardReady, () => {
    run('resync', () => resyncServers(client, logger));
  });
  client.on(Events.GuildMemberUpdate, (_old, member) => {
    run('member update', () =>
      updateServerMember(member.guild.id, member.id, [...member.roles.cache.keys()]),
    );
  });
  client.on(Events.GuildMemberAdd, (member) => {
    run('member join', async () => {
      await updateServerMember(member.guild.id, member.id, [...member.roles.cache.keys()]);
      await markRejoinedDiscord(member.guild.id, member.id);
    });
  });
  client.on(Events.GuildMemberRemove, (member) => {
    run('member leave', async () => {
      await removeServerMember(member.guild.id, member.id);
      await markLeftDiscord(member.guild.id, member.id);
    });
  });
  client.on(Events.GuildRoleDelete, (role) => {
    run('role delete', () => removeServerRole(role.guild.id, role.id));
  });
  client.on(Events.GuildDelete, (server) => {
    run('bot removed', () => removeServer(server.id));
  });
}

/**
 * Reads the members of every connected server once, and with them replaces each guild's
 * Officers and updates who has left. A server the bot isn't in has no Officers, but its
 * members aren't flagged: the bot can't see them, which doesn't mean they left.
 */
export async function resyncServers(client: Pick<Client, 'guilds'>, logger: Logger): Promise<void> {
  for (const guild of await Guild.findAll()) {
    const server = client.guilds.cache.get(guild.discordServerId);
    try {
      if (!server) {
        await replaceGuildOfficers(guild.id, []);
        continue;
      }
      const members = await serverMembers(server);
      await replaceGuildOfficers(guild.id, [
        ...members.filter((member) => member.roles.cache.has(guild.officerRoleId)).keys(),
      ]);
      await syncPresence(guild.id, [...members.keys()]);
    } catch (err) {
      logger.error({ err, guildId: guild.id }, 'Could not resync the server');
    }
  }
  logger.info('Servers resynced');
}

function serverMembers(server: DiscordServer) {
  // Fetching the member list goes over the Gateway (with the GuildMembers intent), not REST.
  return server.members.fetch();
}
