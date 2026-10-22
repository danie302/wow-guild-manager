import type { GuildAccess } from '@wgm/shared';
import { Op } from 'sequelize';

import { Guild, GuildOfficer, Member, type User } from '../db/models/index.js';

/**
 * The user's access to a guild. The Guild Master's comes from the guild itself, an Officer's
 * from `guild_officers`, which the bot keeps in step with the Officer role in Discord, and a
 * member's (read-only) from the roster: active, and not flagged as having left the Discord
 * server. Nothing here calls Discord, so checking access costs no Discord API calls.
 */
export async function guildAccess(user: User, guild: Guild): Promise<GuildAccess | null> {
  if (guild.guildMasterUserId === user.id) return 'guild_master';
  const officer = await GuildOfficer.findOne({
    where: { guildId: guild.id, discordUserId: user.discordId },
  });
  if (officer) return 'officer';
  const member = await Member.findOne({
    attributes: ['id'],
    where: {
      guildId: guild.id,
      discordUserId: user.discordId,
      removedAt: null,
      leftDiscordAt: null,
    },
  });
  return member ? 'member' : null;
}

/** Every guild the user can open, by name. */
export async function accessibleGuilds(
  user: User,
): Promise<{ guild: Guild; access: GuildAccess }[]> {
  const [officerOf, memberOf] = await Promise.all([
    GuildOfficer.findAll({ attributes: ['guildId'], where: { discordUserId: user.discordId } }),
    Member.findAll({
      attributes: ['guildId'],
      where: { discordUserId: user.discordId, removedAt: null, leftDiscordAt: null },
    }),
  ]);
  const officerIds = new Set(officerOf.map((officer) => officer.guildId));
  const guilds = await Guild.findAll({
    where: {
      [Op.or]: [
        { guildMasterUserId: user.id },
        { id: [...officerIds, ...memberOf.map((member) => member.guildId)] },
      ],
    },
    order: [['name', 'ASC']],
  });
  return guilds.map((guild) => ({
    guild,
    access:
      guild.guildMasterUserId === user.id
        ? 'guild_master'
        : officerIds.has(guild.id)
          ? 'officer'
          : 'member',
  }));
}
