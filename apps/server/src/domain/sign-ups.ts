import {
  rolesFor,
  uuidSchema,
  type CombatRole,
  type EventType,
  type Rank,
  type SignUpPlacement,
} from '@wgm/shared';
import { Op, Transaction } from 'sequelize';

import { Character, Event, SignUp, type Guild, type Member } from '../db/models/index.js';
import { transaction } from '../db/transaction.js';
import { memberRank } from './ranks.js';
import { memberOnServer } from './roster.js';

/** Who can join each type of event, from "Who can join events" in requirements.md. */
const RANKS_BY_EVENT_TYPE: Record<EventType, readonly Rank[]> = {
  raid: ['guild_master', 'officer', 'raider'],
  dungeon: ['guild_master', 'officer', 'raider', 'member'],
  pvp: ['guild_master', 'officer', 'raider', 'member'],
};

export function canJoin(rank: Rank, type: EventType): boolean {
  return RANKS_BY_EVENT_TYPE[type].includes(rank);
}

/** Why someone can't sign up (or decline) from Discord. */
export type SignUpRefusal =
  | { result: 'no_guild' }
  | { result: 'not_on_roster'; guild: Guild }
  | { result: 'left_discord' }
  | { result: 'event_not_found' }
  /** The event started or was cancelled. */
  | { result: 'closed'; event: Event }
  | { result: 'not_eligible'; event: Event }
  | { result: 'no_characters' }
  | { result: 'not_your_character' }
  | { result: 'role_not_allowed' };

/** What the sign-up form needs: the member's active characters, main first. */
export interface SignUpContext {
  result: 'ok';
  event: Event;
  member: Member;
  characters: Character[];
  /** Their current sign-up, if any. */
  current: SignUp | null;
}

/**
 * Checks that the Discord user can sign up for the event and gathers what the form shows. Only
 * reads: `signUp` checks everything again, since the form is answered later.
 */
export async function signUpContext(
  serverId: string,
  discordUserId: string,
  eventId: string,
  now = new Date(),
): Promise<SignUpContext | SignUpRefusal> {
  const checked = await checkSignUp(serverId, discordUserId, eventId, now, false);
  if (checked.result !== 'ok') return checked;
  const { event, member } = checked;
  const characters = [...member.characters!].sort(
    (a, b) => Number(b.isMain) - Number(a.isMain) || a.name.localeCompare(b.name),
  );
  if (characters.length === 0) return { result: 'no_characters' };
  const current = await SignUp.findOne({ where: { eventId: event.id, memberId: member.id } });
  return { result: 'ok', event, member, characters, current };
}

export interface SignUpChoice {
  characterId: string;
  role: CombatRole;
  status: 'confirmed' | 'tentative';
}

export type SignUpOutcome =
  | { result: 'signed_up'; event: Event; character: Character; placement: SignUpPlacement }
  | SignUpRefusal;

/**
 * Signs the member up with one of their characters for a role, as Confirmed or Tentative.
 * They get a slot if the role has a free one, and go onto its waitlist otherwise. A member has
 * one sign-up per event: changing only the status or the character keeps their spot or place
 * on the waitlist, while changing the role (or coming back from Declined) is a new sign-up for
 * that role. It runs in one transaction that locks the event first, so parallel sign-ups can't
 * both take the last slot.
 */
export async function signUp(
  serverId: string,
  discordUserId: string,
  eventId: string,
  choice: SignUpChoice,
  now = new Date(),
): Promise<SignUpOutcome> {
  return transaction(async () => {
    const checked = await checkSignUp(serverId, discordUserId, eventId, now, true);
    if (checked.result !== 'ok') return checked;
    const { event, member } = checked;
    const character = member.characters!.find((candidate) => candidate.id === choice.characterId);
    if (!character) return { result: 'not_your_character' };
    if (!rolesFor(character.characterClass).includes(choice.role)) {
      return { result: 'role_not_allowed' };
    }

    const current = await SignUp.findOne({ where: { eventId: event.id, memberId: member.id } });
    if (current?.placement && current.role === choice.role) {
      await current.update({ characterId: character.id, status: choice.status });
      return { result: 'signed_up', event, character, placement: current.placement };
    }

    const taken = await SignUp.count({
      where: {
        eventId: event.id,
        role: choice.role,
        placement: 'slot',
        memberId: { [Op.ne]: member.id },
      },
    });
    const placement: SignUpPlacement = taken < slotsFor(event, choice.role) ? 'slot' : 'waitlist';
    const values = {
      characterId: character.id,
      role: choice.role,
      status: choice.status,
      placement,
      signedUpAt: now,
    };
    if (current) await current.update(values);
    else await SignUp.create({ eventId: event.id, memberId: member.id, ...values });
    return { result: 'signed_up', event, character, placement };
  });
}

export type DeclineOutcome =
  { result: 'declined'; event: Event; wasSignedUp: boolean } | SignUpRefusal;

/**
 * The member won't come. Their sign-up becomes Declined, which releases their spot (story 024
 * promotes from the waitlist). If they weren't signed up, a Declined sign-up with their main
 * records that they let the Guild Master know.
 */
export async function decline(
  serverId: string,
  discordUserId: string,
  eventId: string,
  now = new Date(),
): Promise<DeclineOutcome> {
  return transaction(async () => {
    const checked = await checkSignUp(serverId, discordUserId, eventId, now, true);
    if (checked.result !== 'ok') return checked;
    const { event, member } = checked;

    const current = await SignUp.findOne({ where: { eventId: event.id, memberId: member.id } });
    if (current) {
      const wasSignedUp = current.status !== 'declined';
      await current.update({ status: 'declined', placement: null });
      return { result: 'declined', event, wasSignedUp };
    }
    const main = member.characters!.find((candidate) => candidate.isMain) ?? member.characters![0];
    if (!main) return { result: 'no_characters' };
    await SignUp.create({
      eventId: event.id,
      memberId: member.id,
      characterId: main.id,
      role: null,
      status: 'declined',
      placement: null,
      signedUpAt: now,
    });
    return { result: 'declined', event, wasSignedUp: false };
  });
}

/** The event's sign-ups with their characters, slots before the waitlist, each by sign-up time. */
export async function eventSignUps(eventId: string): Promise<SignUp[]> {
  return SignUp.findAll({
    where: { eventId },
    include: [{ model: Character, as: 'character', attributes: ['name', 'characterClass'] }],
    order: [
      ['signedUpAt', 'ASC'],
      ['id', 'ASC'],
    ],
  });
}

function slotsFor(event: Event, role: CombatRole): number {
  return { tank: event.tankSlots, healer: event.healerSlots, dps: event.dpsSlots }[role];
}

/**
 * The checks every sign-up and decline share: the event belongs to the server's guild and is
 * open, and the Discord user is an active member of a rank that can join it. With `lock`, the
 * event row is locked until the transaction ends.
 */
async function checkSignUp(
  serverId: string,
  discordUserId: string,
  eventId: string,
  now: Date,
  lock: boolean,
): Promise<{ result: 'ok'; event: Event; member: Member } | SignUpRefusal> {
  const { guild, member } = await memberOnServer(serverId, discordUserId);
  if (!guild) return { result: 'no_guild' };
  if (!uuidSchema.safeParse(eventId).success) return { result: 'event_not_found' };
  const event = await Event.findOne({
    where: { id: eventId, guildId: guild.id },
    ...(lock && { lock: Transaction.LOCK.UPDATE }),
  });
  if (!event) return { result: 'event_not_found' };
  if (event.cancelledAt || event.startsAt <= now) return { result: 'closed', event };
  if (!member) return { result: 'not_on_roster', guild };
  if (member.leftDiscordAt) return { result: 'left_discord' };
  if (!canJoin(await memberRank(member, guild), event.type)) {
    return { result: 'not_eligible', event };
  }
  return { result: 'ok', event, member };
}
