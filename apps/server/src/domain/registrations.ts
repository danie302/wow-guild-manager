import type { ApproveRegistrationInput, CharacterInput, Locale } from '@wgm/shared';
import { Op, Transaction, UniqueConstraintError } from 'sequelize';

import { Character, CharacterRegistration, Guild, Member, type User } from '../db/models/index.js';
import { transaction } from '../db/transaction.js';
import type { CharacterLookup } from '../integrations/character-lookup/character-lookup.js';
import { DomainError } from './errors.js';
import { addCharacter, addMember, type DiscordProfile } from './roster.js';

/** What /register did. Only `created` makes a registration. */
export type RegisterOutcome =
  | { result: 'created'; guild: Guild; registration: CharacterRegistration }
  /** The Discord server isn't connected to a guild. */
  | { result: 'no_guild' }
  /** An active character with this name is on this guild's roster. */
  | { result: 'on_roster'; guild: Guild }
  /** An active character with this name is in another guild. */
  | { result: 'in_another_guild' }
  /** The name already has a pending registration in this guild. */
  | { result: 'already_pending' };

/**
 * Registers a character for the guild of the Discord server, for an Officer to approve. The
 * worker then looks it up (lookUpRegistration). `name` must already be valid
 * (characterNameSchema).
 */
export async function registerCharacter(
  serverId: string,
  profile: DiscordProfile,
  name: string,
  locale: Locale | null,
): Promise<RegisterOutcome> {
  const guild = await Guild.findOne({ where: { discordServerId: serverId } });
  if (!guild) return { result: 'no_guild' };

  const existing = await Character.findOne({
    where: { removedAt: null, ...sameName(name) },
    include: [{ model: Member, as: 'member' }],
  });
  if (existing) {
    return existing.member!.guildId === guild.id
      ? { result: 'on_roster', guild }
      : { result: 'in_another_guild' };
  }

  try {
    const registration = await CharacterRegistration.create({
      guildId: guild.id,
      ...profile,
      locale,
      name,
    });
    return { result: 'created', guild, registration };
  } catch (err) {
    // The name has a pending registration here (checked by a unique index).
    if (err instanceof UniqueConstraintError) return { result: 'already_pending' };
    throw err;
  }
}

/**
 * Looks a pending registration's character up and saves what was found. A character of
 * another faction than the guild's is rejected right away. Returns the registration when it
 * was rejected (the member gets a direct message), otherwise null. Does nothing if the
 * registration was reviewed or looked up meanwhile.
 */
export async function lookUpRegistration(
  registrationId: string,
  lookup: CharacterLookup,
): Promise<CharacterRegistration | null> {
  const registration = await CharacterRegistration.findByPk(registrationId);
  if (registration?.status !== 'pending' || registration.lookup !== 'pending') return null;

  // The lookup can be slow, so it runs before the transaction, which re-checks the state.
  const result = await lookup.profile({ name: registration.name });

  return transaction(async () => {
    await registration.reload({ lock: Transaction.LOCK.UPDATE });
    if (registration.status !== 'pending' || registration.lookup !== 'pending') return null;

    if (result.status === 'unavailable') {
      await registration.update({ lookup: 'unavailable' });
      return null;
    }
    if (result.status === 'not_found') {
      await registration.update({ lookup: 'not_found', lookedUpAt: result.fetchedAt });
      return null;
    }

    const { faction, race, characterClass, level } = result.data;
    await registration.update({
      lookup: 'found',
      lookedUpAt: result.fetchedAt,
      faction,
      race,
      characterClass,
      level,
    });
    const guild = (await Guild.findByPk(registration.guildId))!;
    if (faction === guild.faction) return null;
    // The caller sends the direct message, which needs the guild.
    registration.guild = guild;
    await registration.update({
      status: 'rejected',
      rejectionReason: 'wrong_faction',
      reviewedAt: new Date(),
    });
    return registration;
  });
}

/**
 * Approves a pending registration: adds the character to the member, adding them to the
 * roster first if needed (or restoring them, if they were removed). Uses the looked-up race,
 * class, and level when the character was found, otherwise the ones in `input`. Throws
 * validation errors (e.g. the name is taken now) and leaves the registration pending then.
 */
export async function approveRegistration(
  guild: Guild,
  registrationId: string,
  input: ApproveRegistrationInput,
  reviewer: User,
): Promise<CharacterRegistration> {
  return transaction(async () => {
    const registration = await pendingRegistration(guild, registrationId);
    const found = registration.lookup === 'found';
    const character: CharacterInput = {
      name: registration.name,
      faction: guild.faction,
      race: found ? registration.race! : input.race!,
      class: found ? registration.characterClass! : input.class!,
      level: found ? registration.level! : input.level!,
      professions: input.professions ?? [],
    };

    const member = await rosterMember(guild, registration, reviewer);
    // A restored member can get this very character back.
    const restored = await Character.findOne({
      where: { memberId: member.id, removedAt: null, ...sameName(registration.name) },
    });
    const added = restored ?? (await addCharacter(member, guild, character));

    return registration.update({
      status: 'approved',
      characterId: added.id,
      reviewedByUserId: reviewer.id,
      reviewedAt: new Date(),
    });
  });
}

/** Rejects a pending registration. */
export async function rejectRegistration(
  guild: Guild,
  registrationId: string,
  reviewer: User,
): Promise<CharacterRegistration> {
  return transaction(async () => {
    const registration = await pendingRegistration(guild, registrationId);
    return registration.update({
      status: 'rejected',
      reviewedByUserId: reviewer.id,
      reviewedAt: new Date(),
    });
  });
}

/** The registration, locked; NOT_FOUND or REGISTRATION_NOT_PENDING otherwise. */
async function pendingRegistration(
  guild: Guild,
  registrationId: string,
): Promise<CharacterRegistration> {
  const registration = await CharacterRegistration.findOne({
    where: { id: registrationId, guildId: guild.id },
    lock: Transaction.LOCK.UPDATE,
  });
  if (!registration) throw new DomainError({ code: 'NOT_FOUND' });
  if (registration.status !== 'pending') {
    throw new DomainError({ code: 'REGISTRATION_NOT_PENDING' });
  }
  return registration;
}

/** The registered person's active member record, adding them as a Member if needed. */
async function rosterMember(
  guild: Guild,
  registration: CharacterRegistration,
  reviewer: User,
): Promise<Member> {
  const member = await Member.findOne({
    where: { guildId: guild.id, discordUserId: registration.discordUserId, removedAt: null },
  });
  if (member) return member;
  const profile: DiscordProfile = {
    discordUserId: registration.discordUserId,
    discordName: registration.discordName,
    discordAvatar: registration.discordAvatar,
  };
  const { member: added } = await addMember(guild, profile, 'member', reviewer);
  if (registration.locale) await added.update({ locale: registration.locale });
  return added;
}

/** A `where` for a character name, ignoring case. */
function sameName(name: string) {
  const sequelize = Character.sequelize!;
  return {
    [Op.and]: sequelize.where(sequelize.fn('lower', sequelize.col('name')), name.toLowerCase()),
  };
}
