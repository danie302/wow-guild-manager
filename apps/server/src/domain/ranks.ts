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
