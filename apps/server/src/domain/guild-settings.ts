import { randomUUID } from 'node:crypto';

import type { GuildAccess, UpdateGuildInput } from '@wgm/shared';

import type { Guild, User } from '../db/models/index.js';
import type { DiscordDirectory } from '../integrations/discord/directory.js';
import type { FileStorage } from '../storage/file-storage.js';
import { toGuildImage } from '../storage/guild-image.js';
import { DomainError } from './errors.js';
import { checkGuildDiscordChange, withUniqueErrors } from './guilds.js';
import { can, type GuildAction } from './permissions.js';

export interface GuildSettingsDependencies {
  /** Null when the API can't read Discord; then the Discord connection can't change. */
  discord: DiscordDirectory | null;
  storage: FileStorage;
}

/** What changed, so callers know whether to reload the Officers. */
export interface GuildSettingsResult {
  officerRoleChanged: boolean;
}

/**
 * Saves the guild settings page: any of the name, the image (`image` is the uploaded file),
 * and the Discord server and Officer role. Everything is checked first and then saved in one
 * update, so either every change applies or none does. Each change needs its own permission.
 * Throws InvalidImageError when the upload isn't a readable PNG, JPEG, or WebP.
 */
export async function updateGuildSettings(
  user: User,
  guild: Guild,
  access: GuildAccess,
  input: UpdateGuildInput,
  image: Buffer | undefined,
  { discord, storage }: GuildSettingsDependencies,
): Promise<GuildSettingsResult> {
  const require = (action: GuildAction) => {
    if (!can(access, action)) throw new DomainError({ code: 'FORBIDDEN' });
  };
  const changesProfile = input.name !== undefined || image !== undefined || input.removeImage;
  const officerRoleId = input.officerRoleId;
  const discordServerId = input.discordServerId ?? guild.discordServerId;
  const changesDiscord =
    officerRoleId !== undefined &&
    (officerRoleId !== guild.officerRoleId || discordServerId !== guild.discordServerId);

  if (changesProfile) require('editGuildProfile');
  if (changesDiscord) {
    require('connectDiscordServer');
    require('chooseOfficerRole');
    if (!discord) throw new DomainError({ code: 'DISCORD_NOT_CONFIGURED' });
    await checkGuildDiscordChange(user, guild, { discordServerId, officerRoleId }, discord);
  }

  // The new image is stored before the update, and removed again if the update fails.
  const newImageKey = image ? `guilds/${guild.id}/${randomUUID()}.webp` : undefined;
  if (image && newImageKey) await storage.save(newImageKey, await toGuildImage(image));
  const previousImageKey = guild.imageKey;

  try {
    await withUniqueErrors(() =>
      guild.update({
        ...(input.name !== undefined && { name: input.name }),
        ...(changesDiscord && { discordServerId, officerRoleId }),
        ...(newImageKey ? { imageKey: newImageKey } : input.removeImage && { imageKey: null }),
      }),
    );
  } catch (err) {
    if (newImageKey) await storage.delete(newImageKey);
    throw err;
  }

  if (previousImageKey && previousImageKey !== guild.imageKey) {
    await storage.delete(previousImageKey);
  }
  return { officerRoleChanged: changesDiscord };
}

/** Where the browser loads the image. The key is in the URL, so a new image is a new URL. */
export function guildImageUrl(guild: Guild): string | null {
  if (!guild.imageKey) return null;
  const version = guild.imageKey.split('/').at(-1)!.replace('.webp', '');
  return `/api/guilds/${guild.id}/image?v=${version}`;
}
