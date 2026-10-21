import type { Rank } from '@wgm/shared';

import { GuildOfficer, User, type Guild, type Member } from '../db/models/index.js';

/**
 * A member's rank: Guild Master if they lead the guild, Officer if they have its Officer role
 * in Discord, and otherwise the Raider or Member rank set in the app.
 */
export async function memberRank(member: Member, guild: Guild): Promise<Rank> {
  const guildMaster = await User.findByPk(guild.guildMasterUserId, { attributes: ['discordId'] });
  if (guildMaster?.discordId === member.discordUserId) return 'guild_master';
  const officer = await GuildOfficer.findOne({
    where: { guildId: guild.id, discordUserId: member.discordUserId },
  });
  return officer ? 'officer' : member.rank;
}

/** Works out ranks for many members of one guild with two queries, e.g. for the roster. */
export async function rankResolver(guild: Guild): Promise<(member: Member) => Rank> {
  const guildMaster = await User.findByPk(guild.guildMasterUserId, { attributes: ['discordId'] });
  const officers = await GuildOfficer.findAll({ where: { guildId: guild.id } });
  const officerIds = new Set(officers.map((officer) => officer.discordUserId));
  return (member) =>
    member.discordUserId === guildMaster?.discordId
      ? 'guild_master'
      : officerIds.has(member.discordUserId)
        ? 'officer'
        : member.rank;
}
