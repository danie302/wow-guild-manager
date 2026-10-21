import {
  GUILD_ERROR_CODES,
  type CreateGuildInput,
  type DiscordServerOption,
  type GuildDiscordInput,
} from '@wgm/shared';
import { Op, UniqueConstraintError } from 'sequelize';

import { Guild, type User } from '../db/models/index.js';
import {
  canManageServer,
  discordServerIconUrl,
  officerRoleOptions,
  type DiscordDirectory,
  type DiscordRole,
  type DiscordServer,
} from '../integrations/discord/directory.js';
import { DomainError, DomainValidationError } from './errors.js';

/** Creates a guild led by `user`, connected to a Discord server they manage. */
export async function createGuild(
  user: User,
  input: CreateGuildInput,
  discord: DiscordDirectory,
): Promise<Guild> {
  if ((await Guild.count({ where: { guildMasterUserId: user.id } })) > 0) {
    throw new DomainError({ code: 'ALREADY_LEADS_GUILD' });
  }
  await checkDiscordConnection(user, input, discord);
  await checkServerIsFree(input.discordServerId);

  return withUniqueErrors(() => Guild.create({ ...input, guildMasterUserId: user.id }));
}

/**
 * Checks that the guild can be connected to this server and Officer role: the user manages the
 * server, the role is in it, and no other guild uses the server. Callers check the permissions
 * (`connectDiscordServer` and `chooseOfficerRole`) and save the change.
 */
export async function checkGuildDiscordChange(
  user: User,
  guild: Guild,
  input: GuildDiscordInput,
  discord: DiscordDirectory,
): Promise<void> {
  await checkDiscordConnection(user, input, discord);
  await checkServerIsFree(input.discordServerId, guild.id);
}

/** The servers where the bot is and `user` can manage the server, by name. */
export async function discordServerOptions(
  user: User,
  discord: DiscordDirectory,
): Promise<DiscordServerOption[]> {
  const servers = await Promise.all(
    (await discord.botServers()).map((summary) => manageableServer(user, summary.id, discord)),
  );
  const manageable = servers.filter((server) => server !== null);

  const connected = await Guild.findAll({
    attributes: ['discordServerId'],
    where: { discordServerId: manageable.map((server) => server.id) },
  });
  const taken = new Set(connected.map((guild) => guild.discordServerId));

  return manageable
    .map((server) => ({
      id: server.id,
      name: server.name,
      iconUrl: discordServerIconUrl(server),
      available: !taken.has(server.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The roles of a server `user` manages that can grant Officer. */
export async function discordOfficerRoleOptions(
  user: User,
  serverId: string,
  discord: DiscordDirectory,
): Promise<DiscordRole[]> {
  const server = await manageableServer(user, serverId, discord);
  if (!server) {
    throw new DomainError({ code: 'FORBIDDEN' });
  }
  return officerRoleOptions(server);
}

/** The server, if the bot is in it and `user` can manage it. */
async function manageableServer(
  user: User,
  serverId: string,
  discord: DiscordDirectory,
): Promise<DiscordServer | null> {
  const [server, member] = await Promise.all([
    discord.server(serverId),
    discord.member(serverId, user.discordId),
  ]);
  return server && member && canManageServer(server, user.discordId, member) ? server : null;
}

async function checkDiscordConnection(
  user: User,
  input: GuildDiscordInput,
  discord: DiscordDirectory,
): Promise<void> {
  const server = await manageableServer(user, input.discordServerId, discord);
  if (!server) {
    throw new DomainValidationError([
      { field: 'discordServerId', code: GUILD_ERROR_CODES.discordServerNotManageable },
    ]);
  }
  if (!officerRoleOptions(server).some((role) => role.id === input.officerRoleId)) {
    throw new DomainValidationError([
      { field: 'officerRoleId', code: GUILD_ERROR_CODES.officerRoleNotFound },
    ]);
  }
}

async function checkServerIsFree(serverId: string, exceptGuildId?: string): Promise<void> {
  const where = exceptGuildId === undefined ? {} : { id: { [Op.ne]: exceptGuildId } };
  if ((await Guild.count({ where: { ...where, discordServerId: serverId } })) > 0) {
    throw new DomainError({ code: 'DISCORD_SERVER_TAKEN' });
  }
}

/** Two requests at once can both pass the checks above; the unique indexes catch the second. */
export async function withUniqueErrors(save: () => Promise<Guild>): Promise<Guild> {
  try {
    return await save();
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      const fields = Object.keys(err.fields);
      if (fields.includes('discord_server_id')) {
        throw new DomainError({ code: 'DISCORD_SERVER_TAKEN' });
      }
      if (fields.includes('guild_master_user_id')) {
        throw new DomainError({ code: 'ALREADY_LEADS_GUILD' });
      }
    }
    throw err;
  }
}
