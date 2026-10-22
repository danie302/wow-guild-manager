import { randomUUID } from 'node:crypto';

import { GUILD_ERROR_CODES, type GuildAccess, type UpdateGuildInput } from '@wgm/shared';

import type { Guild, User } from '../db/models/index.js';
import type { DiscordDirectory } from '../integrations/discord/directory.js';
import type { FileStorage } from '../storage/file-storage.js';
import { toGuildImage } from '../storage/guild-image.js';
import { DomainError, DomainValidationError } from './errors.js';
import { checkGuildDiscordChange, postableChannels, withUniqueErrors } from './guilds.js';
import { can, type GuildAction } from './permissions.js';

export interface GuildSettingsDependencies {
  /**
   * Reading Discord, and the bot's user ID (to check its permissions in the events channel).
   * Null when the API can't read Discord; then the Discord settings can't change.
   */
  discord: { directory: DiscordDirectory; botUserId: string } | null;
  storage: FileStorage;
}

/** What changed, so callers know whether to reload the Officers or update the event posts. */
export interface GuildSettingsResult {
  officerRoleChanged: boolean;
  /** The events channel or the Discord language changed. */
  eventPostsChanged: boolean;
  /** The Tentative deadline changed. */
  deadlineChanged: boolean;
  /** The reminder time changed. */
  reminderChanged: boolean;
}

/**
 * Saves the guild settings page: any of the name, the image (`image` is the uploaded file),
 * the Discord server and Officer role, the events channel, and the Discord language. A new
 * server without an events channel leaves the guild without one. Everything is checked first and then saved in one
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

  const changesServer = discordServerId !== guild.discordServerId;
  const eventsChannelId = input.eventsChannelId ?? (changesServer ? null : guild.eventsChannelId);
  const changesChannel = eventsChannelId !== guild.eventsChannelId;
  const changesLocale =
    input.discordLocale !== undefined && input.discordLocale !== guild.discordLocale;

  if (changesProfile) require('editGuildProfile');
  if (changesDiscord) {
    require('connectDiscordServer');
    require('chooseOfficerRole');
    if (!discord) throw new DomainError({ code: 'DISCORD_NOT_CONFIGURED' });
    await checkGuildDiscordChange(
      user,
      guild,
      { discordServerId, officerRoleId },
      discord.directory,
    );
  }
  if (changesChannel) {
    require('chooseEventsChannel');
    if (eventsChannelId !== null) {
      if (!discord) throw new DomainError({ code: 'DISCORD_NOT_CONFIGURED' });
      await checkEventsChannel(discordServerId, eventsChannelId, discord);
    }
  }
  if (changesLocale) require('chooseDiscordLanguage');
  const changesDeadline =
    input.tentativeDeadlineHours !== undefined &&
    input.tentativeDeadlineHours !== guild.tentativeDeadlineHours;
  const changesReminder =
    input.reminderHours !== undefined && input.reminderHours !== guild.reminderHours;
  if (changesDeadline || changesReminder) require('setTentativeTimes');

  // The new image is stored before the update, and removed again if the update fails.
  const newImageKey = image ? `guilds/${guild.id}/${randomUUID()}.webp` : undefined;
  if (image && newImageKey) await storage.save(newImageKey, await toGuildImage(image));
  const previousImageKey = guild.imageKey;

  try {
    await withUniqueErrors(() =>
      guild.update({
        ...(input.name !== undefined && { name: input.name }),
        ...(changesDiscord && { discordServerId, officerRoleId }),
        ...(changesChannel && { eventsChannelId }),
        ...(changesLocale && { discordLocale: input.discordLocale }),
        ...(changesDeadline && { tentativeDeadlineHours: input.tentativeDeadlineHours }),
        ...(changesReminder && { reminderHours: input.reminderHours }),
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
  return {
    officerRoleChanged: changesDiscord,
    eventPostsChanged: changesChannel || changesLocale,
    deadlineChanged: changesDeadline,
    reminderChanged: changesReminder,
  };
}

/** The bot must be able to see, write, and post embeds in the events channel. */
async function checkEventsChannel(
  serverId: string,
  channelId: string,
  { directory, botUserId }: NonNullable<GuildSettingsDependencies['discord']>,
): Promise<void> {
  const server = await directory.server(serverId);
  const options = server ? await postableChannels(server, directory, botUserId) : [];
  if (!options.some(({ channel }) => channel.id === channelId)) {
    throw new DomainValidationError([
      { field: 'eventsChannelId', code: GUILD_ERROR_CODES.eventsChannelNotUsable },
    ]);
  }
}

/** Where the browser loads the image. The key is in the URL, so a new image is a new URL. */
export function guildImageUrl(guild: Guild): string | null {
  if (!guild.imageKey) return null;
  const version = guild.imageKey.split('/').at(-1)!.replace('.webp', '');
  return `/api/guilds/${guild.id}/image?v=${version}`;
}
