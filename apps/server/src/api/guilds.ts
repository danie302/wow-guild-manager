import {
  createGuildSchema,
  guildDiscordSchema,
  type GuildAccess,
  type GuildResponse,
} from '@wgm/shared';
import express from 'express';

import type { Guild } from '../db/models/index.js';
import { changeGuildDiscord, createGuild } from '../domain/guilds.js';
import { replaceGuildOfficers } from '../domain/officers.js';
import { discordServerIconUrl, type DiscordDirectory } from '../integrations/discord/directory.js';
import type { Logger } from '../logger.js';
import { requireDiscord, type DiscordAccess } from './discord.js';
import { sendValidationError } from './errors.js';
import { currentGuild, requireGuildPermission } from './guild-access.js';
import { currentUser, requireUser } from './me.js';

export function guildsRouter(discord: DiscordAccess | null) {
  const router = express.Router();

  router.post('/guilds', requireUser, requireDiscord(discord), async (req, res) => {
    const input = createGuildSchema.safeParse(req.body);
    if (!input.success) {
      sendValidationError(res, input.error, req.body);
      return;
    }
    const guild = await createGuild(currentUser(res), input.data, discord!.directory);
    await loadOfficers(guild, discord!.directory, req.log);
    res.status(201).json(await toGuildResponse(guild, 'guild_master', discord, req.log));
  });

  router.get(
    '/guilds/:guildId',
    requireUser,
    requireGuildPermission('viewGuild'),
    async (req, res) => {
      const { guild, access } = currentGuild(res);
      res.json(await toGuildResponse(guild, access, discord, req.log));
    },
  );

  // Changes the server and the role together, since a role belongs to one server.
  router.put(
    '/guilds/:guildId/discord',
    requireUser,
    requireGuildPermission('connectDiscordServer'),
    requireGuildPermission('chooseOfficerRole'),
    requireDiscord(discord),
    async (req, res) => {
      const { guild, access } = currentGuild(res);
      const input = guildDiscordSchema.safeParse(req.body);
      if (!input.success) {
        sendValidationError(res, input.error, req.body);
        return;
      }
      await changeGuildDiscord(currentUser(res), guild, input.data, discord!.directory);
      await loadOfficers(guild, discord!.directory, req.log);
      res.json(await toGuildResponse(guild, access, discord, req.log));
    },
  );

  return router;
}

/**
 * Reads who has the guild's Officer role, when the guild is created or its role changes. After
 * that the bot keeps the list current from Discord's events. If Discord fails here, the bot's
 * resync on its next start fills it in, so the guild is saved anyway.
 */
async function loadOfficers(guild: Guild, directory: DiscordDirectory, log: Logger) {
  try {
    const officers = await directory.membersWithRole(guild.discordServerId, guild.officerRoleId);
    await replaceGuildOfficers(guild.id, officers);
  } catch (err) {
    log.warn({ err, guildId: guild.id }, 'Could not read the Officers from Discord');
  }
}

/** Adds the server's and role's names from Discord. If Discord can't be read, they're null. */
async function toGuildResponse(
  guild: Guild,
  access: GuildAccess,
  discord: DiscordAccess | null,
  log: Logger,
): Promise<GuildResponse> {
  const server = discord ? await serverOrNull(discord.directory, guild.discordServerId, log) : null;
  const role = server?.roles.find((candidate) => candidate.id === guild.officerRoleId);
  return {
    id: guild.id,
    name: guild.name,
    faction: guild.faction,
    access,
    discordServer: {
      id: guild.discordServerId,
      name: server?.name ?? null,
      iconUrl: server ? discordServerIconUrl(server) : null,
    },
    officerRole: { id: guild.officerRoleId, name: role?.name ?? null },
  };
}

async function serverOrNull(directory: DiscordDirectory, serverId: string, log: Logger) {
  try {
    return await directory.server(serverId);
  } catch (err) {
    log.warn({ err }, 'Could not read the Discord server; showing the guild without its names');
    return null;
  }
}
