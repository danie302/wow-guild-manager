import { GUILD_ERROR_CODES, type Rank } from '@wgm/shared';
import { Transaction } from 'sequelize';

import { Guild, Member, RankChange, User } from '../db/models/index.js';
import { transaction } from '../db/transaction.js';
import { DomainError, DomainValidationError } from './errors.js';
import { memberRank } from './ranks.js';

/** Who the Guild Master can hand the guild to: active members, and the guild each one leads. */
export async function transferCandidates(
  guild: Guild,
): Promise<{ member: Member; leads: string | null }[]> {
  const leader = (await User.findByPk(guild.guildMasterUserId))!;
  const members = await Member.findAll({
    where: { guildId: guild.id, removedAt: null },
    order: [['discordName', 'ASC']],
  });
  const others = members.filter((member) => member.discordUserId !== leader.discordId);
  const users = await User.findAll({
    where: { discordId: others.map((member) => member.discordUserId) },
  });
  const led = await Guild.findAll({
    attributes: ['name', 'guildMasterUserId'],
    where: { guildMasterUserId: users.map((user) => user.id) },
  });
  const leads = new Map(
    led.map((other) => [
      users.find((user) => user.id === other.guildMasterUserId)!.discordId,
      other.name,
    ]),
  );
  return others.map((member) => ({ member, leads: leads.get(member.discordUserId) ?? null }));
}

/**
 * The Guild Master hands the guild to another active member who doesn't lead a guild. The old
 * Guild Master stays on the roster as a Raider (still an Officer if Discord says so), and both
 * changes go in the rank history. The new one gets an app account if they never logged in, so
 * the guild can point at it; their Discord login finds it later.
 */
export async function transferLeadership(
  guild: Guild,
  by: User,
  memberId: string,
): Promise<Member> {
  return transaction(async () => {
    const locked = (await Guild.findByPk(guild.id, { lock: Transaction.LOCK.UPDATE }))!;
    if (locked.guildMasterUserId !== by.id) throw new DomainError({ code: 'FORBIDDEN' });
    const target = await Member.findOne({
      where: { id: memberId, guildId: guild.id, removedAt: null },
    });
    if (!target || target.discordUserId === by.discordId) {
      throw new DomainError({ code: 'NOT_FOUND' });
    }

    const [user] = await User.findOrCreate({
      where: { discordId: target.discordUserId },
      defaults: {
        discordId: target.discordUserId,
        name: target.discordName,
        avatar: target.discordAvatar,
      },
    });
    if ((await Guild.count({ where: { guildMasterUserId: user.id } })) > 0) {
      throw new DomainError({ code: 'ALREADY_LEADS_GUILD' });
    }
    const oldLeader = await Member.findOne({
      where: { guildId: guild.id, discordUserId: by.discordId },
    });
    const targetRank: Rank = await memberRank(target, locked);

    await locked.update({ guildMasterUserId: user.id });
    await guild.reload();
    const change = { changedByUserId: by.id, source: 'app' as const };
    await RankChange.create({
      memberId: target.id,
      fromRank: targetRank,
      toRank: 'guild_master',
      ...change,
    });
    if (oldLeader) {
      await oldLeader.update({ rank: 'raider' });
      await RankChange.create({
        memberId: oldLeader.id,
        fromRank: 'guild_master',
        toRank: await memberRank(oldLeader, locked),
        ...change,
      });
    }
    return target;
  });
}

/**
 * Deletes the guild and everything in it (roster, events, attendance) once the Guild Master
 * typed its name. Resolves what's left to clean up outside the database: the Discord server the
 * bot leaves, and the guild image.
 */
export async function disbandGuild(
  guild: Guild,
  confirmName: string,
): Promise<{ discordServerId: string; imageKey: string | null }> {
  if (confirmName.trim() !== guild.name.trim()) {
    throw new DomainValidationError([{ field: 'name', code: GUILD_ERROR_CODES.nameDoesntMatch }]);
  }
  const left = { discordServerId: guild.discordServerId, imageKey: guild.imageKey };
  await guild.destroy();
  return left;
}
