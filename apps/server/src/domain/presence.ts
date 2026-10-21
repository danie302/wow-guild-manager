import { Op, type WhereOptions } from 'sequelize';

import { Guild, Member, Registration } from '../db/models/index.js';
import { transaction } from '../db/transaction.js';

/*
 * Who has left the guild's Discord server. Members (and people with a pending request to join)
 * who leave are flagged with the date, never removed: an Officer decides. The flag is cleared
 * when they come back. The bot keeps it current from Gateway events and on every connect.
 */

/** Flags someone who just left the Discord server, in the guild connected to it. */
export async function markLeftDiscord(
  serverId: string,
  discordUserId: string,
  at = new Date(),
): Promise<void> {
  const guild = await Guild.findOne({ where: { discordServerId: serverId } });
  if (!guild) return;
  await setLeftDiscordAt({ guildId: guild.id, discordUserId, leftDiscordAt: null }, at);
}

/** Clears the flag of someone who came back to the Discord server. */
export async function markRejoinedDiscord(serverId: string, discordUserId: string): Promise<void> {
  const guild = await Guild.findOne({ where: { discordServerId: serverId } });
  if (!guild) return;
  await setLeftDiscordAt(
    { guildId: guild.id, discordUserId, leftDiscordAt: { [Op.ne]: null } },
    null,
  );
}

/**
 * Brings the flags in line with the server's current members, for changes missed while the
 * bot was offline. Someone found missing is flagged with the time of this check, since the
 * real time isn't known.
 */
export async function syncPresence(
  guildId: string,
  serverMemberIds: readonly string[],
  at = new Date(),
): Promise<void> {
  // NOT IN with an empty list matches nothing in SQL, so an empty server needs no condition.
  const missing = serverMemberIds.length > 0 ? { [Op.notIn]: serverMemberIds } : { [Op.ne]: '' };
  await setLeftDiscordAt({ guildId, leftDiscordAt: null, discordUserId: missing }, at);
  await setLeftDiscordAt(
    { guildId, leftDiscordAt: { [Op.ne]: null }, discordUserId: { [Op.in]: serverMemberIds } },
    null,
  );
}

/** Members and requests to join share the columns this needs. */
async function setLeftDiscordAt(where: WhereOptions, leftDiscordAt: Date | null): Promise<void> {
  await transaction(async () => {
    await Member.update({ leftDiscordAt }, { where });
    await Registration.update({ leftDiscordAt }, { where });
  });
}
