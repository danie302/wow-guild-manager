import {
  discordIdSchema,
  type DiscordRolesResponse,
  type DiscordServersResponse,
} from '@wgm/shared';
import express, { type RequestHandler } from 'express';

import { discordOfficerRoleOptions, discordServerOptions } from '../domain/guilds.js';
import { discordRoleColor, type DiscordDirectory } from '../integrations/discord/directory.js';
import { sendError } from './errors.js';
import { currentUser, requireUser } from './me.js';

/** Reading Discord with the bot token. Null when `DISCORD_BOT_TOKEN` or the client ID isn't set. */
export interface DiscordAccess {
  directory: DiscordDirectory;
  botInviteUrl: string;
}

/** Answers 503 when the API can't read Discord. */
export function requireDiscord(discord: DiscordAccess | null): RequestHandler {
  return (_req, res, next) => {
    if (!discord) {
      sendError(res, 503, { code: 'DISCORD_NOT_CONFIGURED' });
      return;
    }
    next();
  };
}

/** Discord servers and roles for the guild setup and settings. */
export function discordRouter(discord: DiscordAccess | null) {
  const router = express.Router();
  router.use('/discord', requireUser, requireDiscord(discord));

  router.get('/discord/servers', async (_req, res) => {
    const { directory, botInviteUrl } = discord!;
    const servers = await discordServerOptions(currentUser(res), directory);
    res.json({ servers, botInviteUrl } satisfies DiscordServersResponse);
  });

  router.get('/discord/servers/:serverId/roles', async (req, res) => {
    const serverId = discordIdSchema.safeParse(req.params.serverId);
    if (!serverId.success) {
      sendError(res, 404, { code: 'NOT_FOUND' });
      return;
    }
    const roles = await discordOfficerRoleOptions(
      currentUser(res),
      serverId.data,
      discord!.directory,
    );
    res.json({
      roles: roles.map((role) => ({ id: role.id, name: role.name, color: discordRoleColor(role) })),
    } satisfies DiscordRolesResponse);
  });

  return router;
}
