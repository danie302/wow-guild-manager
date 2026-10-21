import type { Locale } from '@wgm/shared';
import { Transaction, UniqueConstraintError } from 'sequelize';

import { Guild, Member, Registration, type User } from '../db/models/index.js';
import { transaction } from '../db/transaction.js';
import { DomainError } from './errors.js';
import { addMember, type DiscordProfile } from './roster.js';

/** What /register did. Only `created` makes a request. */
export type RegisterOutcome =
  | { result: 'created'; guild: Guild; registration: Registration }
  /** The Discord server isn't connected to a guild. */
  | { result: 'no_guild' }
  /** They're on the guild's roster already. */
  | { result: 'on_roster'; guild: Guild }
  /** They already have a request waiting. */
  | { result: 'already_pending'; guild: Guild };

/**
 * Asks to join the roster of the Discord server's guild, for the Guild Master or an Officer to
 * approve. Characters aren't part of it: Officers add them in the web app.
 */
export async function requestToJoin(
  serverId: string,
  profile: DiscordProfile,
  locale: Locale | null,
): Promise<RegisterOutcome> {
  const guild = await Guild.findOne({ where: { discordServerId: serverId } });
  if (!guild) return { result: 'no_guild' };

  const onRoster = await Member.count({
    where: { guildId: guild.id, discordUserId: profile.discordUserId, removedAt: null },
  });
  if (onRoster > 0) return { result: 'on_roster', guild };

  try {
    const registration = await Registration.create({ guildId: guild.id, ...profile, locale });
    return { result: 'created', guild, registration };
  } catch (err) {
    // They have a pending request in this guild (checked by a unique index).
    if (err instanceof UniqueConstraintError) return { result: 'already_pending', guild };
    throw err;
  }
}

export interface ApproveResult {
  registration: Registration;
  member: Member;
  /** True when a removed member was added back, with their characters. */
  restored: boolean;
}

/**
 * Approves a pending request: adds them to the roster as a Member, or restores their old
 * record (rank, characters, history) if they were removed. If someone added them by hand
 * meanwhile, it only closes the request.
 */
export async function approveRegistration(
  guild: Guild,
  registrationId: string,
  reviewer: User,
): Promise<ApproveResult> {
  return transaction(async () => {
    const registration = await pendingRegistration(guild, registrationId);
    let member = await Member.findOne({
      where: { guildId: guild.id, discordUserId: registration.discordUserId, removedAt: null },
    });
    let restored = false;
    if (!member) {
      const profile: DiscordProfile = {
        discordUserId: registration.discordUserId,
        discordName: registration.discordName,
        discordAvatar: registration.discordAvatar,
      };
      ({ member, restored } = await addMember(guild, profile, 'member', reviewer));
      if (registration.locale) await member.update({ locale: registration.locale });
    }
    await registration.update({
      status: 'approved',
      reviewedByUserId: reviewer.id,
      reviewedAt: new Date(),
    });
    return { registration, member, restored };
  });
}

/** Rejects a pending request. */
export async function rejectRegistration(
  guild: Guild,
  registrationId: string,
  reviewer: User,
): Promise<Registration> {
  return transaction(async () => {
    const registration = await pendingRegistration(guild, registrationId);
    return registration.update({
      status: 'rejected',
      reviewedByUserId: reviewer.id,
      reviewedAt: new Date(),
    });
  });
}

/** The request, locked; NOT_FOUND or REGISTRATION_NOT_PENDING otherwise. */
async function pendingRegistration(guild: Guild, registrationId: string): Promise<Registration> {
  const registration = await Registration.findOne({
    where: { id: registrationId, guildId: guild.id },
    lock: Transaction.LOCK.UPDATE,
  });
  if (!registration) throw new DomainError({ code: 'NOT_FOUND' });
  if (registration.status !== 'pending') {
    throw new DomainError({ code: 'REGISTRATION_NOT_PENDING' });
  }
  return registration;
}
