import type { Locale, MeResponse } from '@wgm/shared';

import { Guild, User } from '../db/models/index.js';
import { discordAvatarUrl, type DiscordProfile } from './discord-oauth.js';

/** Settings a new user starts with, taken from the browser they first log in from. */
export interface InitialSettings {
  locale: Locale;
  timeZone: string;
}

/**
 * Finds or creates the app user for a Discord account and refreshes their name and avatar.
 * `initial` is only used for a new user: an existing user keeps the settings they chose.
 */
export async function upsertUserFromDiscord(
  profile: DiscordProfile,
  initial: InitialSettings,
): Promise<User> {
  const [user, created] = await User.findOrCreate({
    where: { discordId: profile.id },
    defaults: { discordId: profile.id, name: profile.name, avatar: profile.avatar, ...initial },
  });
  if (!created) {
    await user.update({ name: profile.name, avatar: profile.avatar });
  }
  return user;
}

export async function toMeResponse(user: User): Promise<MeResponse> {
  const led = await Guild.findAll({
    where: { guildMasterUserId: user.id },
    order: [['id', 'ASC']],
  });
  return {
    id: user.id,
    discordId: user.discordId,
    name: user.name,
    avatarUrl: discordAvatarUrl(user.discordId, user.avatar),
    locale: user.locale,
    timeZone: user.timeZone,
    theme: user.theme,
    guilds: led.map((guild) => ({ id: guild.id, name: guild.name, access: 'guild_master' })),
  };
}
