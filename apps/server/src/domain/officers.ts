import { Op } from 'sequelize';

import { Guild, GuildOfficer, Member, RankChange, User } from '../db/models/index.js';

/**
 * Keeps `guild_officers` (who has each guild's Officer role) in step with Discord. The bot
 * calls these on Discord's events and when it starts; the API calls `replaceGuildOfficers`
 * when a guild is created or its Officer role changes. Discord server IDs identify the guild,
 * since that's what Discord's events carry. Roster members who gain or lose the role get an
 * entry in their rank history, from Discord.
 */

/** Sets the guild's Officers to exactly `discordUserIds`. */
export async function replaceGuildOfficers(
  guildId: string,
  discordUserIds: readonly string[],
): Promise<void> {
  const sequelize = GuildOfficer.sequelize!;
  await sequelize.transaction(async () => {
    const current = (await GuildOfficer.findAll({ where: { guildId } })).map(
      (officer) => officer.discordUserId,
    );
    const added = discordUserIds.filter((id) => !current.includes(id));
    const removed = current.filter((id) => !discordUserIds.includes(id));

    await GuildOfficer.destroy({ where: { guildId, discordUserId: removed } });
    await GuildOfficer.bulkCreate(
      added.map((discordUserId) => ({ guildId, discordUserId })),
      { ignoreDuplicates: true },
    );
    await recordRankChanges(guildId, added, removed);
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
  const sequelize = GuildOfficer.sequelize!;
  await sequelize.transaction(async () => {
    const where = { guildId: guild.id, discordUserId };
    const isOfficer = (await GuildOfficer.count({ where })) > 0;
    if (roleIds.includes(guild.officerRoleId) && !isOfficer) {
      await GuildOfficer.create(where);
      await recordRankChanges(guild.id, [discordUserId], []);
    } else if (!roleIds.includes(guild.officerRoleId) && isOfficer) {
      await GuildOfficer.destroy({ where });
      await recordRankChanges(guild.id, [], [discordUserId]);
    }
  });
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

/**
 * Records gaining or losing the Officer role in the rank history of roster members. The Guild
 * Master's rank doesn't change with the role, so they get no entry.
 */
async function recordRankChanges(
  guildId: string,
  added: readonly string[],
  removed: readonly string[],
): Promise<void> {
  if (added.length === 0 && removed.length === 0) return;
  const guild = await Guild.findByPk(guildId, {
    include: [{ model: User, as: 'guildMaster', attributes: ['discordId'] }],
  });
  const members = await Member.findAll({
    where: { guildId, removedAt: null, discordUserId: { [Op.in]: [...added, ...removed] } },
  });
  for (const member of members) {
    if (member.discordUserId === guild?.guildMaster?.discordId) continue;
    const gained = added.includes(member.discordUserId);
    await RankChange.create({
      memberId: member.id,
      fromRank: gained ? member.rank : 'officer',
      toRank: gained ? 'officer' : member.rank,
      changedByUserId: null,
      source: 'discord',
    });
  }
}
