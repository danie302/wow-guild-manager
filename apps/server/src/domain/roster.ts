import {
  CHARACTER_ERROR_CODES,
  characterSchema,
  toValidationIssues,
  type BaseRank,
  type CharacterInput,
  type Locale,
  type ValidationIssueCode,
} from '@wgm/shared';
import { Op, Transaction, UniqueConstraintError } from 'sequelize';

import {
  Character,
  Guild,
  Member,
  OfficerNote,
  RankChange,
  type User,
} from '../db/models/index.js';
import { transaction } from '../db/transaction.js';
import { DomainError, DomainValidationError } from './errors.js';
import { memberRank } from './ranks.js';

/** Who a member is on Discord, from the server's member list or the bot. */
export interface DiscordProfile {
  discordUserId: string;
  discordName: string;
  discordAvatar: string | null;
}

export interface AddMemberResult {
  member: Member;
  /** True when a removed member was added back, with their old record. */
  restored: boolean;
  /** Characters of a restored member that stay removed, because their name is taken now. */
  unrestoredCharacters: Character[];
}

/**
 * Adds a Discord user to the guild's roster, with their characters. A member who was removed
 * gets their old record back (rank, characters, rank history, notes, attendance) instead of a
 * new one; `rank` only applies to new members. Throws MEMBER_ALREADY_ON_ROSTER for someone on
 * the roster, and a validation error for an invalid character (nothing is saved then).
 */
export async function addMember(
  guild: Guild,
  profile: DiscordProfile,
  rank: BaseRank,
  addedBy: User | null,
  characters: readonly CharacterInput[] = [],
): Promise<AddMemberResult> {
  return transaction(async () => {
    const existing = await Member.findOne({
      where: { guildId: guild.id, discordUserId: profile.discordUserId },
      lock: Transaction.LOCK.UPDATE,
    });
    if (existing && !existing.removedAt) {
      throw new DomainError({ code: 'MEMBER_ALREADY_ON_ROSTER' });
    }

    let result: AddMemberResult;
    if (existing) {
      result = { member: existing, restored: true, unrestoredCharacters: [] };
      result.unrestoredCharacters = await restoreMember(existing, profile);
    } else {
      const member = await Member.create({ guildId: guild.id, ...profile, rank });
      await RankChange.create({
        memberId: member.id,
        fromRank: null,
        toRank: await memberRank(member, guild),
        changedByUserId: addedBy?.id ?? null,
        source: 'app',
      });
      result = { member, restored: false, unrestoredCharacters: [] };
    }

    for (const [index, character] of characters.entries()) {
      await addCharacterTo(result.member, guild, character, `characters.${index}.`);
    }
    return result;
  });
}

/**
 * Brings back a removed member and the characters removed with them. A character whose name
 * another active character has taken stays removed, and is returned. If their main can't come
 * back, the first character that does becomes the main.
 */
async function restoreMember(member: Member, profile: DiscordProfile): Promise<Character[]> {
  const removedWithMember = await Character.findAll({
    where: { memberId: member.id, removedAt: member.removedAt },
    order: [
      ['isMain', 'DESC'],
      ['createdAt', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  await member.update({ ...profile, removedAt: null });

  const unrestored: Character[] = [];
  let hasMain = false;
  for (const character of removedWithMember) {
    if (await nameTaken(character.name)) {
      unrestored.push(character);
      continue;
    }
    await character.update({ removedAt: null, isMain: !hasMain });
    hasMain = true;
  }
  return unrestored;
}

/**
 * Adds a character to a member, checked with the shared schema and against the guild's
 * faction. The member's first character becomes their main.
 */
export async function addCharacter(
  member: Member,
  guild: Guild,
  input: CharacterInput,
): Promise<Character> {
  return transaction(() => addCharacterTo(member, guild, input, ''));
}

async function addCharacterTo(
  member: Member,
  guild: Guild,
  input: CharacterInput,
  fieldPrefix: string,
): Promise<Character> {
  const parsed = characterSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainValidationError(
      toValidationIssues(parsed.error, input).map((issue) => ({
        ...issue,
        field: fieldPrefix + issue.field,
      })),
    );
  }
  const { class: characterClass, ...character } = parsed.data;
  const invalid = (field: string, code: ValidationIssueCode) =>
    new DomainValidationError([{ field: fieldPrefix + field, code }]);

  if (character.faction !== guild.faction) {
    throw invalid('faction', CHARACTER_ERROR_CODES.wrongFaction);
  }
  if (await nameTaken(character.name)) {
    throw invalid('name', CHARACTER_ERROR_CODES.nameTaken);
  }

  const hasCharacters = await Character.count({
    where: { memberId: member.id, removedAt: null },
  });
  // A character this member had and removed comes back with its history.
  const removed = await Character.findOne({
    where: { memberId: member.id, removedAt: { [Op.ne]: null }, ...sameName(character.name) },
    order: [['removedAt', 'DESC']],
  });
  const details = { ...character, characterClass, isMain: hasCharacters === 0 };
  try {
    return removed
      ? await removed.update({ ...details, removedAt: null })
      : await Character.create({ ...details, memberId: member.id });
  } catch (err) {
    // Another request took the name between the check and the insert.
    if (err instanceof UniqueConstraintError) {
      throw invalid('name', CHARACTER_ERROR_CODES.nameTaken);
    }
    throw err;
  }
}

/**
 * Whether an active character anywhere in the game has this name (ignoring case), other than
 * `exceptId`.
 */
async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
  const count = await Character.count({
    where: {
      removedAt: null,
      ...sameName(name),
      ...(exceptId && { id: { [Op.ne]: exceptId } }),
    },
  });
  return count > 0;
}

/** A `where` for a character name, ignoring case. */
function sameName(name: string) {
  const sequelize = Character.sequelize!;
  return {
    [Op.and]: sequelize.where(sequelize.fn('lower', sequelize.col('name')), name.toLowerCase()),
  };
}

/**
 * Changes a character's name, race, class, level, and professions, with the same checks as
 * adding one. The faction stays the guild's.
 */
export async function updateCharacter(
  member: Member,
  guild: Guild,
  characterId: string,
  input: CharacterInput,
): Promise<Character> {
  return transaction(async () => {
    const character = await activeCharacter(member, characterId);
    const parsed = characterSchema.safeParse(input);
    if (!parsed.success) {
      throw new DomainValidationError(toValidationIssues(parsed.error, input));
    }
    const { class: characterClass, ...details } = parsed.data;
    const invalid = (field: string, code: ValidationIssueCode) =>
      new DomainValidationError([{ field, code }]);
    if (details.faction !== guild.faction) {
      throw invalid('faction', CHARACTER_ERROR_CODES.wrongFaction);
    }
    if (await nameTaken(details.name, character.id)) {
      throw invalid('name', CHARACTER_ERROR_CODES.nameTaken);
    }
    try {
      return await character.update({ ...details, characterClass });
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        throw invalid('name', CHARACTER_ERROR_CODES.nameTaken);
      }
      throw err;
    }
  });
}

/**
 * Removes one of a member's characters. Its record stays, marked as removed, so past sign-ups
 * and attendance remain, and its name is free. If it was the main, the member's oldest
 * remaining character becomes the main.
 */
export async function removeCharacter(member: Member, characterId: string): Promise<Character> {
  return transaction(async () => {
    const character = await activeCharacter(member, characterId);
    // Its own timestamp, so restoring the member later doesn't bring it back.
    await character.update({ removedAt: new Date(), isMain: false });
    const hasMain = await Character.count({
      where: { memberId: member.id, removedAt: null, isMain: true },
    });
    if (!hasMain) {
      const oldest = await Character.findOne({
        where: { memberId: member.id, removedAt: null },
        // UUID v7 IDs follow creation order, even within one millisecond.
        order: [
          ['createdAt', 'ASC'],
          ['id', 'ASC'],
        ],
      });
      await oldest?.update({ isMain: true });
    }
    return character;
  });
}

async function activeCharacter(member: Member, characterId: string): Promise<Character> {
  const character = await Character.findOne({
    where: { id: characterId, memberId: member.id, removedAt: null },
    lock: Transaction.LOCK.UPDATE,
  });
  if (!character) throw new DomainError({ code: 'NOT_FOUND' });
  return character;
}

/**
 * Changes a member's Raider or Member rank, and records it in their rank history. The entry
 * shows the Raider or Member change itself, even for an Officer, whose rank stays Officer.
 */
export async function changeRank(member: Member, rank: BaseRank, changedBy: User): Promise<void> {
  if (member.rank === rank) return;
  await transaction(async () => {
    const from = member.rank;
    await member.update({ rank });
    await RankChange.create({
      memberId: member.id,
      fromRank: from,
      toRank: rank,
      changedByUserId: changedBy.id,
      source: 'app',
    });
  });
}

/** Makes one of the member's active characters their main. */
export async function setMainCharacter(member: Member, characterId: string): Promise<void> {
  await transaction(async () => {
    const character = await Character.findOne({
      where: { id: characterId, memberId: member.id, removedAt: null },
    });
    if (!character) throw new DomainError({ code: 'NOT_FOUND' });
    // Unset first: the database allows only one active main per member.
    await Character.update(
      { isMain: false },
      { where: { memberId: member.id, isMain: true, removedAt: null } },
    );
    await character.update({ isMain: true });
  });
}

/** The Discord user's active member record in the guild of a Discord server, if any. */
export async function memberOnServer(
  serverId: string,
  discordUserId: string,
): Promise<{ guild: Guild | null; member: Member | null }> {
  const guild = await Guild.findOne({ where: { discordServerId: serverId } });
  if (!guild) return { guild: null, member: null };
  const member = await Member.findOne({
    where: { guildId: guild.id, discordUserId, removedAt: null },
    include: [{ model: Character, as: 'characters', where: { removedAt: null }, required: false }],
    order: [[{ model: Character, as: 'characters' }, 'name', 'ASC']],
  });
  return { guild, member };
}

/** Why a member's command about one of their characters can't go ahead. */
export type OwnCharacterRefusal =
  | { result: 'no_guild' }
  | { result: 'not_on_roster'; guild: Guild }
  | { result: 'not_your_character' };

/**
 * One of the Discord user's active characters in the guild of a Discord server, by name
 * (ignoring case) or ID, for their commands in Discord.
 */
export async function ownCharacter(
  serverId: string,
  discordUserId: string,
  match: { name: string } | { id: string },
): Promise<{ result: 'found'; member: Member; character: Character } | OwnCharacterRefusal> {
  const { guild, member } = await memberOnServer(serverId, discordUserId);
  if (!guild) return { result: 'no_guild' };
  if (!member) return { result: 'not_on_roster', guild };
  const character = member.characters!.find((candidate) =>
    'id' in match
      ? candidate.id === match.id
      : candidate.name.toLowerCase() === match.name.trim().toLowerCase(),
  );
  return character ? { result: 'found', member, character } : { result: 'not_your_character' };
}

/** What /main did. */
export type ChooseMainOutcome =
  { result: 'changed' | 'already_main'; name: string } | OwnCharacterRefusal;

/** A member picks their main from Discord, by the name of one of their active characters. */
export async function chooseMainByName(
  serverId: string,
  discordUserId: string,
  name: string,
): Promise<ChooseMainOutcome> {
  const own = await ownCharacter(serverId, discordUserId, { name });
  if (own.result !== 'found') return own;
  const { member, character } = own;
  if (character.isMain) return { result: 'already_main', name: character.name };
  await setMainCharacter(member, character.id);
  return { result: 'changed', name: character.name };
}

/** What /character remove did once confirmed. */
export type RemoveOwnCharacterOutcome =
  { result: 'removed'; name: string; newMain: string | null } | OwnCharacterRefusal;

/**
 * A member removes one of their own characters from Discord, after confirming. Checked again
 * here, since the confirmation can come later: it must still be theirs and active.
 */
export async function removeOwnCharacter(
  serverId: string,
  discordUserId: string,
  characterId: string,
): Promise<RemoveOwnCharacterOutcome> {
  const own = await ownCharacter(serverId, discordUserId, { id: characterId });
  if (own.result !== 'found') return own;
  const { member, character } = own;
  await removeCharacter(member, character.id);
  const main = character.isMain
    ? await Character.findOne({ where: { memberId: member.id, removedAt: null, isMain: true } })
    : null;
  return { result: 'removed', name: character.name, newMain: main?.name ?? null };
}

/**
 * Removes a member from the roster. Their record and characters stay, marked as removed, so
 * past sign-ups and attendance remain, and their character names are free for other guilds.
 * The Guild Master can't be removed.
 */
export async function removeMember(member: Member, guild: Guild): Promise<void> {
  if ((await memberRank(member, guild)) === 'guild_master') {
    throw new DomainError({ code: 'GUILD_MASTER_CANNOT_BE_REMOVED' });
  }
  await transaction(async () => {
    // The same timestamp marks which characters to bring back if the member returns. It must
    // differ from characters removed on their own, even within the same millisecond.
    const lastRemoved = await Character.max<Date | null, Character>('removedAt', {
      where: { memberId: member.id },
    });
    const removedAt = new Date(Math.max(Date.now(), (lastRemoved?.getTime() ?? 0) + 1));
    await member.update({ removedAt });
    await Character.update({ removedAt }, { where: { memberId: member.id, removedAt: null } });
  });
}

export async function addOfficerNote(
  member: Member,
  author: User,
  text: string,
): Promise<OfficerNote> {
  return OfficerNote.create({ memberId: member.id, authorUserId: author.id, text });
}

/** The bot keeps each member's Discord name and avatar current in every guild they're in. */
export async function updateDiscordProfile(profile: DiscordProfile): Promise<void> {
  await Member.update(
    { discordName: profile.discordName, discordAvatar: profile.discordAvatar },
    { where: { discordUserId: profile.discordUserId } },
  );
}

/** Remembers the language of a member's latest interaction with the bot, for their DMs. */
export async function recordMemberLocale(
  serverId: string,
  discordUserId: string,
  locale: Locale,
): Promise<void> {
  const guild = await Guild.findOne({ where: { discordServerId: serverId } });
  if (!guild) return;
  await Member.update({ locale }, { where: { guildId: guild.id, discordUserId } });
}
