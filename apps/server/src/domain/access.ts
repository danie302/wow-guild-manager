import type { GuildAccess } from '@wgm/shared';
import { Op } from 'sequelize';

import { Guild, GuildOfficer, type User } from '../db/models/index.js';

/**
 * The user's access to a guild. The Guild Master's comes from the guild itself, and an
 * Officer's from `guild_officers`, which the bot keeps in step with the Officer role in
 * Discord. Nothing here calls Discord, so checking access costs no Discord API calls.
 */
export async function guildAccess(user: User, guild: Guild): Promise<GuildAccess | null> {
  if (guild.guildMasterUserId === user.id) return 'guild_master';
  const officer = await GuildOfficer.findOne({
    where: { guildId: guild.id, discordUserId: user.discordId },
  });
  return officer ? 'officer' : null;
}

/** Every guild the user can open, by name. */
export async function accessibleGuilds(
  user: User,
): Promise<{ guild: Guild; access: GuildAccess }[]> {
  const officerOf = await GuildOfficer.findAll({
    attributes: ['guildId'],
    where: { discordUserId: user.discordId },
  });
  const guilds = await Guild.findAll({
    where: {
      [Op.or]: [
        { guildMasterUserId: user.id },
        { id: officerOf.map((officer) => officer.guildId) },
      ],
    },
    order: [['name', 'ASC']],
  });
  return guilds.map((guild) => ({
    guild,
    access: guild.guildMasterUserId === user.id ? 'guild_master' : 'officer',
  }));
}
