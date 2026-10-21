import { uuidSchema, type GuildAccess } from '@wgm/shared';
import type { RequestHandler, Response } from 'express';

import { Guild } from '../db/models/index.js';
import { guildAccess } from '../domain/access.js';
import { DomainError } from '../domain/errors.js';
import { can, type GuildAction } from '../domain/permissions.js';
import { currentUser } from './me.js';

/**
 * Loads the guild from `:guildId` and the user's access to it, and answers 404 when there's
 * no such guild and 403 when the user can't do `action` there. Use after `requireUser`.
 * Officer access is read from the database, which the bot keeps in step with Discord.
 */
export function requireGuildPermission(action: GuildAction): RequestHandler {
  return async (req, res, next) => {
    const id = req.params.guildId;
    const guild = uuidSchema.safeParse(id).success ? await Guild.findByPk(id as string) : null;
    if (!guild) {
      throw new DomainError({ code: 'NOT_FOUND' });
    }
    const access = await guildAccess(currentUser(res), guild);
    if (!can(access, action)) {
      throw new DomainError({ code: 'FORBIDDEN' });
    }
    res.locals.guild = guild;
    res.locals.access = access;
    next();
  };
}

/** The guild that `requireGuildPermission` loaded for this request, and the user's access. */
export function currentGuild(res: Response): { guild: Guild; access: GuildAccess } {
  return { guild: res.locals.guild as Guild, access: res.locals.access as GuildAccess };
}
