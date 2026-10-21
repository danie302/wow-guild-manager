import {
  addMemberSchema,
  changeRankSchema,
  officerNoteSchema,
  ROSTER_ERROR_CODES,
  setMainCharacterSchema,
  uuidSchema,
  type AddMemberResponse,
  type CharacterInput,
  type DiscordMemberOption,
  type MemberDetailResponse,
  type Rank,
  type RosterCharacter,
  type RosterMember,
} from '@wgm/shared';
import express, { type RequestHandler, type Response } from 'express';

import { discordAvatarUrl } from '../auth/discord-oauth.js';
import {
  Character,
  Member,
  OfficerNote,
  RankChange,
  User,
  type Guild,
} from '../db/models/index.js';
import { DomainError, DomainValidationError } from '../domain/errors.js';
import { canChangeRankOf, canRemove } from '../domain/permissions.js';
import { rankResolver } from '../domain/ranks.js';
import {
  addCharacter,
  addMember,
  addOfficerNote,
  changeRank,
  removeCharacter,
  removeMember,
  setMainCharacter,
  updateCharacter,
} from '../domain/roster.js';
import { requireDiscord, type DiscordAccess } from './discord.js';
import { parseBody } from './errors.js';
import { currentGuild, requireGuildPermission } from './guild-access.js';
import { currentUser, requireUser } from './me.js';

const SEARCH_LIMIT = 10;

/** The guild's roster: members, their characters, rank history, and officer notes. */
export function membersRouter(discord: DiscordAccess | null) {
  const router = express.Router();
  const base = '/guilds/:guildId/members';

  router.get(base, requireUser, requireGuildPermission('viewRoster'), async (_req, res) => {
    const { guild } = currentGuild(res);
    const members = await Member.findAll({
      where: { guildId: guild.id, removedAt: null },
      include: [
        { model: Character, as: 'characters', where: { removedAt: null }, required: false },
      ],
      order: [['discordName', 'ASC']],
    });
    const rankOf = await rankResolver(guild);
    res.json(members.map((member) => toRosterMember(member, rankOf(member))));
  });

  router.post(
    base,
    requireUser,
    requireGuildPermission('addCharacters'),
    requireDiscord(discord),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const input = parseBody(addMemberSchema, req.body, res);
      if (!input) return;
      // Checks the user is on the server and takes their current name: one call, when adding.
      const profile = await discord!.directory.member(guild.discordServerId, input.discordUserId);
      if (!profile) {
        throw new DomainValidationError([
          { field: 'discordUserId', code: ROSTER_ERROR_CODES.notInServer },
        ]);
      }
      const result = await addMember(
        guild,
        { discordUserId: profile.id, discordName: profile.name, discordAvatar: profile.avatar },
        input.rank,
        currentUser(res),
        input.characters,
      );
      res.status(result.restored ? 200 : 201).json({
        member: await memberDetail(result.member, guild),
        restored: result.restored,
        unrestoredCharacters: result.unrestoredCharacters.map((character) => character.name),
      } satisfies AddMemberResponse);
    },
  );

  router.get(
    `${base}/:memberId`,
    requireUser,
    requireGuildPermission('viewRoster'),
    requireMember,
    async (_req, res) => {
      const { guild } = currentGuild(res);
      res.json(await memberDetail(currentMember(res), guild));
    },
  );

  // Changes the Raider or Member rank. Officers can do it only for Raiders and Members.
  router.patch(
    `${base}/:memberId`,
    requireUser,
    requireGuildPermission('changeMemberRank'),
    requireMember,
    async (req, res) => {
      const { guild, access } = currentGuild(res);
      const member = currentMember(res);
      const input = parseBody(changeRankSchema, req.body, res);
      if (!input) return;
      if (!canChangeRankOf(access, (await rankResolver(guild))(member))) {
        throw new DomainError({ code: 'FORBIDDEN' });
      }
      await changeRank(member, input.rank, currentUser(res));
      res.json(await memberDetail(member, guild));
    },
  );

  // Removes from the roster. Officers can remove only Raiders and Members.
  router.delete(
    `${base}/:memberId`,
    requireUser,
    requireGuildPermission('viewRoster'),
    requireMember,
    async (_req, res) => {
      const { guild, access } = currentGuild(res);
      const member = currentMember(res);
      // The Guild Master passes this for anyone, and removeMember refuses to remove them.
      if (!canRemove(access, (await rankResolver(guild))(member))) {
        throw new DomainError({ code: 'FORBIDDEN' });
      }
      await removeMember(member, guild);
      res.status(204).end();
    },
  );

  router.post(
    `${base}/:memberId/characters`,
    requireUser,
    requireGuildPermission('addCharacters'),
    requireMember,
    async (req, res) => {
      const { guild } = currentGuild(res);
      // addCharacter checks the character (and answers with its issues).
      await addCharacter(currentMember(res), guild, req.body as CharacterInput);
      res.status(201).json(await memberDetail(currentMember(res), guild));
    },
  );

  // Edits a character: name, race, class, level, and professions (the faction stays).
  router.put(
    `${base}/:memberId/characters/:characterId`,
    requireUser,
    requireGuildPermission('editCharacters'),
    requireMember,
    async (req, res) => {
      const { guild } = currentGuild(res);
      // updateCharacter checks the character (and answers with its issues).
      await updateCharacter(
        currentMember(res),
        guild,
        characterId(req.params.characterId),
        req.body as CharacterInput,
      );
      res.json(await memberDetail(currentMember(res), guild));
    },
  );

  router.delete(
    `${base}/:memberId/characters/:characterId`,
    requireUser,
    requireGuildPermission('editCharacters'),
    requireMember,
    async (req, res) => {
      const { guild } = currentGuild(res);
      await removeCharacter(currentMember(res), characterId(req.params.characterId));
      res.json(await memberDetail(currentMember(res), guild));
    },
  );

  router.put(
    `${base}/:memberId/main`,
    requireUser,
    requireGuildPermission('changeMainCharacter'),
    requireMember,
    async (req, res) => {
      const { guild } = currentGuild(res);
      const input = parseBody(setMainCharacterSchema, req.body, res);
      if (!input) return;
      await setMainCharacter(currentMember(res), input.characterId);
      res.json(await memberDetail(currentMember(res), guild));
    },
  );

  router.post(
    `${base}/:memberId/notes`,
    requireUser,
    requireGuildPermission('officerNotes'),
    requireMember,
    async (req, res) => {
      const { guild } = currentGuild(res);
      const input = parseBody(officerNoteSchema, req.body, res);
      if (!input) return;
      await addOfficerNote(currentMember(res), currentUser(res), input.text);
      res.status(201).json(await memberDetail(currentMember(res), guild));
    },
  );

  // Server members to pick from when adding a member by hand. One Discord search per query.
  router.get(
    '/guilds/:guildId/discord-members',
    requireUser,
    requireGuildPermission('addCharacters'),
    requireDiscord(discord),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
      if (query.length < 2) {
        res.json([]);
        return;
      }
      const found = await discord!.directory.searchMembers(
        guild.discordServerId,
        query,
        SEARCH_LIMIT,
      );
      const onRoster = await Member.findAll({
        attributes: ['discordUserId'],
        where: { guildId: guild.id, removedAt: null, discordUserId: found.map((user) => user.id) },
      });
      const onRosterIds = new Set(onRoster.map((member) => member.discordUserId));
      res.json(
        found.map((user) => ({
          id: user.id,
          name: user.name,
          avatarUrl: discordAvatarUrl(user.id, user.avatar),
          onRoster: onRosterIds.has(user.id),
        })) satisfies DiscordMemberOption[],
      );
    },
  );

  return router;
}

/** Loads the active member from `:memberId` in the current guild, or answers 404. */
function characterId(id: unknown): string {
  if (!uuidSchema.safeParse(id).success) throw new DomainError({ code: 'NOT_FOUND' });
  return id as string;
}

const requireMember: RequestHandler = async (req, res, next) => {
  const { guild } = currentGuild(res);
  const id = req.params.memberId;
  const member = uuidSchema.safeParse(id).success
    ? await Member.findOne({ where: { id: id as string, guildId: guild.id, removedAt: null } })
    : null;
  if (!member) throw new DomainError({ code: 'NOT_FOUND' });
  res.locals.member = member;
  next();
};

function currentMember(res: Response): Member {
  return res.locals.member as Member;
}

function toRosterCharacter(character: Character): RosterCharacter {
  return {
    id: character.id,
    name: character.name,
    faction: character.faction,
    race: character.race,
    class: character.characterClass,
    level: character.level,
    professions: character.professions,
    isMain: character.isMain,
  };
}

function toRosterMember(member: Member, rank: Rank): RosterMember {
  const characters = (member.characters ?? [])
    .filter((character) => !character.removedAt)
    .sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.name.localeCompare(b.name));
  return {
    id: member.id,
    discordUserId: member.discordUserId,
    discordName: member.discordName,
    avatarUrl: discordAvatarUrl(member.discordUserId, member.discordAvatar),
    rank,
    baseRank: member.rank,
    characters: characters.map(toRosterCharacter),
    leftDiscordAt: member.leftDiscordAt?.toISOString() ?? null,
  };
}

/** A member with their characters, rank history, and officer notes, newest first. */
async function memberDetail(member: Member, guild: Guild): Promise<MemberDetailResponse> {
  const characters = await Character.findAll({ where: { memberId: member.id, removedAt: null } });
  const history = await RankChange.findAll({
    where: { memberId: member.id },
    include: [{ model: User, as: 'changedBy', attributes: ['name'] }],
    order: [['createdAt', 'DESC']],
  });
  const notes = await OfficerNote.findAll({
    where: { memberId: member.id },
    include: [{ model: User, as: 'author', attributes: ['name'] }],
    order: [['createdAt', 'DESC']],
  });
  const fresh = await member.reload();
  fresh.characters = characters;
  return {
    ...toRosterMember(fresh, (await rankResolver(guild))(fresh)),
    rankHistory: history.map((change) => ({
      id: change.id,
      fromRank: change.fromRank,
      toRank: change.toRank,
      source: change.source,
      changedBy: change.changedBy?.name ?? null,
      at: change.createdAt.toISOString(),
    })),
    officerNotes: notes.map((note) => ({
      id: note.id,
      text: note.text,
      author: note.author?.name ?? null,
      at: note.createdAt.toISOString(),
    })),
  };
}
