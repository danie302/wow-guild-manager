import {
  discordIdSchema,
  type DiscordChannelsResponse,
  type DiscordRolesResponse,
  type DiscordServersResponse,
} from '@wgm/shared';
import express, { type RequestHandler } from 'express';

import {
  discordEventChannelOptions,
  discordOfficerRoleOptions,
  discordServerOptions,
} from '../domain/guilds.js';
import type { PostEmojis } from '../domain/event-post.js';
import { discordRoleColor, type DiscordDirectory } from '../integrations/discord/directory.js';
import { sendError } from './errors.js';
import { currentUser, requireUser } from './me.js';

/** Reading Discord with the bot token. Null when `DISCORD_BOT_TOKEN` or the client ID isn't set. */
export interface DiscordAccess {
  directory: DiscordDirectory;
  botInviteUrl: string;
  /** The bot's Discord user ID (its application's client ID), to check its permissions. */
  botUserId: string;
  /** The class and role icons of event posts, for their preview; without it, the fallback ones. */
  emojis?: () => Promise<PostEmojis>;
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

/** Discord servers, roles, and channels for the guild setup and settings. */
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

  router.get('/discord/servers/:serverId/channels', async (req, res) => {
    const serverId = discordIdSchema.safeParse(req.params.serverId);
    if (!serverId.success) {
      sendError(res, 404, { code: 'NOT_FOUND' });
      return;
    }
    const options = await discordEventChannelOptions(
      currentUser(res),
      serverId.data,
      discord!.directory,
      discord!.botUserId,
    );
    res.json({
      channels: options.map(({ channel, category }) => ({
        id: channel.id,
        name: channel.name,
        category: category?.name ?? null,
      })),
    } satisfies DiscordChannelsResponse);
  });

  return router;
}
