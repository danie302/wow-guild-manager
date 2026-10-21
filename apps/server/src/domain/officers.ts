import { Op } from 'sequelize';

import { Guild, GuildOfficer } from '../db/models/index.js';

/**
 * Keeps `guild_officers` (who has each guild's Officer role) in step with Discord. The bot
 * calls these on Discord's events and when it starts; the API calls `replaceGuildOfficers`
 * when a guild is created or its Officer role changes. Discord server IDs identify the guild,
 * since that's what Discord's events carry.
 */

/** Sets the guild's Officers to exactly `discordUserIds`. */
export async function replaceGuildOfficers(
  guildId: string,
  discordUserIds: readonly string[],
): Promise<void> {
  const sequelize = GuildOfficer.sequelize!;
  await sequelize.transaction(async () => {
    await GuildOfficer.destroy({
      where: { guildId, discordUserId: { [Op.notIn]: [...discordUserIds] } },
    });
    await GuildOfficer.bulkCreate(
      discordUserIds.map((discordUserId) => ({ guildId, discordUserId })),
      { ignoreDuplicates: true },
    );
  });
}

/** After a member's roles change (or they join): adds or removes them as Officer. */
export async function updateServerMember(
  serverId: string,
  discordUserId: string,
  roleIds: readonly string[],
): Promise<void> {
  const guild = await Guild.findOne({ where: { discordServerId: serverId } });
  if (!guild) return;
  if (roleIds.includes(guild.officerRoleId)) {
    await GuildOfficer.findOrCreate({
      where: { guildId: guild.id, discordUserId },
      defaults: { guildId: guild.id, discordUserId },
    });
  } else {
    await GuildOfficer.destroy({ where: { guildId: guild.id, discordUserId } });
  }
}

/** After a member leaves the server. */
export async function removeServerMember(serverId: string, discordUserId: string) {
  await updateServerMember(serverId, discordUserId, []);
}

/** After a role is deleted in Discord: if it was the Officer role, nobody is Officer anymore. */
export async function removeServerRole(serverId: string, roleId: string): Promise<void> {
  const guild = await Guild.findOne({
    where: { discordServerId: serverId, officerRoleId: roleId },
  });
  if (guild) await replaceGuildOfficers(guild.id, []);
}

/** After the bot leaves the server (or is kicked): it can't see the roles anymore. */
export async function removeServer(serverId: string): Promise<void> {
  const guild = await Guild.findOne({ where: { discordServerId: serverId } });
  if (guild) await replaceGuildOfficers(guild.id, []);
}
