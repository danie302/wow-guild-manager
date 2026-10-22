import {
  createGuildSchema,
  disbandGuildSchema,
  transferLeadershipSchema,
  type TransferCandidate,
  GUILD_IMAGE_MAX_BYTES,
  GUILD_IMAGE_TYPES,
  updateGuildSchema,
  type GuildAccess,
  type GuildResponse,
} from '@wgm/shared';
import express, { type RequestHandler } from 'express';
import multer from 'multer';

import type { Guild } from '../db/models/index.js';
import { guildImageUrl, updateGuildSettings } from '../domain/guild-settings.js';
import { createGuild } from '../domain/guilds.js';
import { disbandGuild, transferCandidates, transferLeadership } from '../domain/leadership.js';
import { replaceGuildOfficers } from '../domain/officers.js';
import { applyGuildDeadline } from '../domain/tentative.js';
import { enqueueEventPosts, enqueueUpcomingEventPosts } from '../jobs/event-posts.js';
import { scheduleEventJobs, upcomingEventIds } from '../jobs/event-jobs.js';
import type { JobEnqueuer } from '../jobs/index.js';
import { discordServerIconUrl, type DiscordDirectory } from '../integrations/discord/directory.js';
import type { Logger } from '../logger.js';
import type { FileStorage } from '../storage/file-storage.js';
import { InvalidImageError } from '../storage/guild-image.js';
import { requireDiscord, type DiscordAccess } from './discord.js';
import { parseBody, sendError, sendValidationError } from './errors.js';
import { currentGuild, requireGuildPermission } from './guild-access.js';
import { currentUser, requireUser } from './me.js';

/**
 * Reads the multipart body: text fields into `req.body`, the `image` file into `req.file`.
 * Other file types and files over the limit are rejected before they're read.
 */
const imageUpload: RequestHandler = (req, res, next) => {
  let unsupported = false;
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: GUILD_IMAGE_MAX_BYTES, files: 1, fields: 10 },
    fileFilter: (_req, file, accept) => {
      unsupported = !(GUILD_IMAGE_TYPES as readonly string[]).includes(file.mimetype);
      accept(null, !unsupported);
    },
  }).single('image')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        sendError(res, 413, { code: 'FILE_TOO_LARGE' });
      } else {
        // Another file field, too many fields, and the like.
        sendError(res, 400, {
          code: 'VALIDATION_ERROR',
          issues: [{ field: err.field ?? '', code: 'INVALID_VALUE' }],
        });
      }
    } else if (err) {
      next(err);
    } else if (unsupported) {
      sendError(res, 415, { code: 'UNSUPPORTED_FILE_TYPE' });
    } else {
      next();
    }
  });
};

/**
 * Changing the events channel or the Discord language asks the worker (`jobs`) to update the
 * posts of upcoming events; without it (some tests), they don't change.
 */
export function guildsRouter(
  discord: DiscordAccess | null,
  storage: FileStorage,
  jobs: JobEnqueuer | null,
) {
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

  // The settings page's single save: name, image, and Discord connection, all or nothing.
  // multipart/form-data, with the image (if any) in the `image` field.
  router.patch(
    '/guilds/:guildId',
    requireUser,
    requireGuildPermission('viewGuild'),
    imageUpload,
    async (req, res) => {
      const { guild, access } = currentGuild(res);
      const input = updateGuildSchema.safeParse(req.body ?? {});
      if (!input.success) {
        sendValidationError(res, input.error, req.body);
        return;
      }
      try {
        const { officerRoleChanged, eventPostsChanged, deadlineChanged, reminderChanged } =
          await updateGuildSettings(currentUser(res), guild, access, input.data, req.file?.buffer, {
            discord,
            storage,
          });
        if (officerRoleChanged) await loadOfficers(guild, discord!.directory, req.log);
        if (eventPostsChanged && jobs) await enqueueUpcomingEventPosts(jobs, guild.id);
        // Events keep their deadline when the new one would already have passed.
        const moved = deadlineChanged ? await applyGuildDeadline(guild) : [];
        if ((deadlineChanged || reminderChanged) && jobs) {
          await enqueueEventPosts(jobs, moved);
          await scheduleEventJobs(jobs, reminderChanged ? await upcomingEventIds(guild.id) : moved);
        }
      } catch (err) {
        if (err instanceof InvalidImageError) {
          sendError(res, 400, { code: 'INVALID_IMAGE' });
          return;
        }
        throw err;
      }
      res.json(await toGuildResponse(guild, access, discord, req.log));
    },
  );

  // Who the Guild Master can hand the guild to, and the guild each already leads.
  router.get(
    '/guilds/:guildId/transfer-candidates',
    requireUser,
    requireGuildPermission('transferLeadership'),
    async (_req, res) => {
      const { guild } = currentGuild(res);
      res.json(
        (await transferCandidates(guild)).map(({ member, leads }) => ({
          memberId: member.id,
          discordName: member.discordName,
          leads,
        })) satisfies TransferCandidate[],
      );
    },
  );

  // Applies right away, outside the settings page's Save.
  router.post(
    '/guilds/:guildId/transfer',
    requireUser,
    requireGuildPermission('transferLeadership'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const input = parseBody(transferLeadershipSchema, req.body, res);
      if (!input) return;
      await transferLeadership(guild, currentUser(res), input.memberId);
      res.status(204).end();
    },
  );

  // Deletes the guild and all of its data; the bot then leaves its Discord server.
  router.post(
    '/guilds/:guildId/disband',
    requireUser,
    requireGuildPermission('disbandGuild'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const input = parseBody(disbandGuildSchema, req.body, res);
      if (!input) return;
      const { discordServerId, imageKey } = await disbandGuild(guild, input.name);
      if (imageKey) await storage.delete(imageKey);
      if (jobs) await jobs.enqueue('leave-server', { discordServerId });
      res.status(204).end();
    },
  );

  // Only people who can open the guild see its image. The URL changes with each new image,
  // so the browser can keep it for a long time.
  router.get(
    '/guilds/:guildId/image',
    requireUser,
    requireGuildPermission('viewGuild'),
    async (_req, res) => {
      const { guild } = currentGuild(res);
      const image = guild.imageKey ? await storage.read(guild.imageKey) : null;
      if (!image) {
        sendError(res, 404, { code: 'NOT_FOUND' });
        return;
      }
      res.set('Cache-Control', 'private, max-age=31536000, immutable');
      res.type('image/webp').send(image);
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
    imageUrl: guildImageUrl(guild),
    access,
    discordServer: {
      id: guild.discordServerId,
      name: server?.name ?? null,
      iconUrl: server ? discordServerIconUrl(server) : null,
    },
    officerRole: { id: guild.officerRoleId, name: role?.name ?? null },
    eventsChannel: guild.eventsChannelId
      ? { id: guild.eventsChannelId, name: await eventsChannelName(guild, discord, log) }
      : null,
    discordLocale: guild.discordLocale,
    tentativeDeadlineHours: guild.tentativeDeadlineHours,
    reminderHours: guild.reminderHours,
    attendanceThresholds: {
      good: guild.attendanceGoodThreshold,
      atRisk: guild.attendanceRiskThreshold,
    },
  };
}

/** The events channel's name, or null when there's none or Discord can't be read. */
export async function eventsChannelName(
  guild: Guild,
  discord: DiscordAccess | null,
  log: Logger,
): Promise<string | null> {
  if (!guild.eventsChannelId || !discord) return null;
  try {
    const channels = await discord.directory.channels(guild.discordServerId);
    return channels.find((channel) => channel.id === guild.eventsChannelId)?.name ?? null;
  } catch (err) {
    log.warn({ err }, 'Could not read the Discord channels; showing the channel without its name');
    return null;
  }
}

async function serverOrNull(directory: DiscordDirectory, serverId: string, log: Logger) {
  try {
    return await directory.server(serverId);
  } catch (err) {
    log.warn({ err }, 'Could not read the Discord server; showing the guild without its names');
    return null;
  }
}
