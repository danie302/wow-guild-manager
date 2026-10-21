import { createGuildSchema, guildDiscordSchema, type GuildResponse } from '@wgm/shared';
import express from 'express';

import { Guild, type User } from '../db/models/index.js';
import { DomainError } from '../domain/errors.js';
import { changeGuildDiscord, createGuild } from '../domain/guilds.js';
import { discordServerIconUrl, type DiscordDirectory } from '../integrations/discord/directory.js';
import type { Logger } from '../logger.js';
import { requireDiscord, type DiscordAccess } from './discord.js';
import { sendValidationError } from './errors.js';
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
    res.status(201).json(await toGuildResponse(guild, discord, req.log));
  });

  router.get('/guilds/:guildId', requireUser, async (req, res) => {
    const guild = await guildForGuildMaster(req.params.guildId, currentUser(res));
    res.json(await toGuildResponse(guild, discord, req.log));
  });

  router.put('/guilds/:guildId/discord', requireUser, requireDiscord(discord), async (req, res) => {
    const guild = await guildForGuildMaster(req.params.guildId, currentUser(res));
    const input = guildDiscordSchema.safeParse(req.body);
    if (!input.success) {
      sendValidationError(res, input.error, req.body);
      return;
    }
    await changeGuildDiscord(currentUser(res), guild, input.data, discord!.directory);
    res.json(await toGuildResponse(guild, discord, req.log));
  });

  return router;
}

/** The guild with the ID from the URL, or a 404. */
async function findGuild(id: unknown): Promise<Guild> {
  const guild =
    typeof id === 'string' && /^\d+$/.test(id) ? await Guild.findByPk(Number(id)) : null;
  if (!guild) {
    throw new DomainError({ code: 'NOT_FOUND' });
  }
  return guild;
}

/** For now only the Guild Master can open their guild. Story 014 adds Officers. */
async function guildForGuildMaster(id: unknown, user: User): Promise<Guild> {
  const guild = await findGuild(id);
  if (guild.guildMasterUserId !== user.id) {
    throw new DomainError({ code: 'FORBIDDEN' });
  }
  return guild;
}

/** Adds the server's and role's names from Discord. If Discord can't be read, they're null. */
async function toGuildResponse(
  guild: Guild,
  discord: DiscordAccess | null,
  log: Logger,
): Promise<GuildResponse> {
  const server = discord ? await serverOrNull(discord.directory, guild.discordServerId, log) : null;
  const role = server?.roles.find((candidate) => candidate.id === guild.officerRoleId);
  return {
    id: guild.id,
    name: guild.name,
    faction: guild.faction,
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
