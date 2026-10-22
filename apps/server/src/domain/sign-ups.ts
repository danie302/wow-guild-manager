import {
  COMBAT_ROLES,
  EVENT_ERROR_CODES,
  rolesFor,
  signUpsLosingSlots,
  uuidSchema,
  type CombatRole,
  type EventType,
  type Rank,
  type SignUpPlacement,
} from '@wgm/shared';
import { Op, Transaction } from 'sequelize';

import { Character, Event, Member, SignUp, type Guild } from '../db/models/index.js';
import { transaction } from '../db/transaction.js';
import { DomainError, DomainValidationError } from './errors.js';
import { memberRank } from './ranks.js';
import { memberOnServer } from './roster.js';

/**
 * What a change did to other people's sign-ups, for the caller to tell them (direct messages
 * from the worker) and update the posts (see jobs/sign-up-notices.ts).
 */
export interface SignUpChanges {
  /** Sign-ups that got a slot from the waitlist. */
  promoted: string[];
  /** Sign-ups that lost their slot because the role's slots went down. */
  movedToWaitlist: string[];
  /** Participants of events whose date or time changed. */
  rescheduled: { memberId: string; eventId: string }[];
  /** Tentative participants replaced by a waitlisted character (now at the end of the waitlist). */
  replaced: string[];
  /** Participants an Officer or the Guild Master removed from an event. */
  removed: { memberId: string; eventId: string; byUserId: string }[];
  /** Events whose sign-ups changed outside a sign-up, so their posts need updating. */
  eventIds: string[];
}

export function noSignUpChanges(): SignUpChanges {
  return {
    promoted: [],
    movedToWaitlist: [],
    rescheduled: [],
    replaced: [],
    removed: [],
    eventIds: [],
  };
}

export function mergeSignUpChanges(...all: SignUpChanges[]): SignUpChanges {
  return {
    promoted: all.flatMap((changes) => changes.promoted),
    movedToWaitlist: all.flatMap((changes) => changes.movedToWaitlist),
    rescheduled: all.flatMap((changes) => changes.rescheduled),
    replaced: all.flatMap((changes) => changes.replaced),
    removed: all.flatMap((changes) => changes.removed),
    eventIds: [...new Set(all.flatMap((changes) => changes.eventIds))],
  };
}

/**
 * Brings the event's slots in line with its sign-ups: if a role has more participants than
 * slots, the most recent ones move to the front of its waitlist; if it has open slots, the
 * earliest waitlisted characters of that role get them. Call it with the event locked, after
 * anything that can open or remove a slot.
 */
export async function balanceSlots(event: Event): Promise<SignUpChanges> {
  const changes = noSignUpChanges();
  const active = await SignUp.findAll({
    where: { eventId: event.id, placement: { [Op.ne]: null } },
    order: [
      ['signedUpAt', 'ASC'],
      ['id', 'ASC'],
    ],
  });
  for (const signUp of signUpsLosingSlots(active, slotsOf(event))) {
    await signUp.update({ placement: 'waitlist' });
    changes.movedToWaitlist.push(signUp.id);
  }
  for (const role of COMBAT_ROLES) {
    const inRole = active.filter((signUp) => signUp.role === role);
    const open = slotsFor(event, role) - inRole.filter((s) => s.placement === 'slot').length;
    for (const signUp of inRole.filter((s) => s.placement === 'waitlist').slice(0, open)) {
      await signUp.update({ placement: 'slot' });
      changes.promoted.push(signUp.id);
    }
  }
  return changes;
}

/**
 * Removes a member's (or one character's) sign-ups for events that haven't started and aren't
 * cancelled, when they're removed from the roster, and fills the spots they free. Past
 * sign-ups stay for attendance. Each event is locked while it changes, one at a time.
 */
export async function releaseSignUps(
  where: { memberId: string } | { characterId: string },
  now = new Date(),
): Promise<SignUpChanges> {
  return transaction(async () => {
    const upcoming = await SignUp.findAll({
      where,
      include: [
        {
          model: Event,
          as: 'event',
          attributes: ['id'],
          where: { startsAt: { [Op.gt]: now }, cancelledAt: null },
        },
      ],
    });
    const eventIds = [...new Set(upcoming.map((signUp) => signUp.eventId))].sort();
    const all = [noSignUpChanges()];
    for (const eventId of eventIds) {
      const event = await Event.findByPk(eventId, { lock: Transaction.LOCK.UPDATE });
      await SignUp.destroy({ where: { ...where, eventId } });
      all.push({ ...(await balanceSlots(event!)), eventIds: [eventId] });
    }
    return mergeSignUpChanges(...all);
  });
}

/**
 * The Guild Master pre-confirms participants of a new raid: each character must be active on
 * the roster, its member able to join raids and still in the Discord server, its class able to
 * fill the role, and each member at most once. The roles' slots were checked with the input.
 */
export async function preConfirm(
  guild: Guild,
  event: Event,
  entries: { characterId: string; role: CombatRole }[],
  now: Date,
): Promise<void> {
  const invalid = (
    index: number,
    code: (typeof EVENT_ERROR_CODES)[keyof typeof EVENT_ERROR_CODES],
  ) => new DomainValidationError([{ field: `preConfirmed.${index}`, code }]);
  const members = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    const character = await Character.findOne({
      where: { id: entry.characterId, removedAt: null },
      include: [{ model: Member, as: 'member', where: { guildId: guild.id, removedAt: null } }],
    });
    const member = character?.member;
    if (
      !character ||
      !member ||
      member.leftDiscordAt ||
      !canJoin(await memberRank(member, guild), event.type)
    ) {
      throw invalid(index, EVENT_ERROR_CODES.preConfirmedCannotJoin);
    }
    if (!rolesFor(character.characterClass).includes(entry.role)) {
      throw invalid(index, EVENT_ERROR_CODES.preConfirmedRoleNotAllowed);
    }
    if (members.has(member.id)) throw invalid(index, EVENT_ERROR_CODES.preConfirmedTwice);
    members.add(member.id);
    await SignUp.create({
      eventId: event.id,
      memberId: member.id,
      characterId: character.id,
      role: entry.role,
      status: 'confirmed',
      placement: 'slot',
      signedUpAt: now,
    });
  }
}

/**
 * The Guild Master or an Officer removes a participant (in a slot or on the waitlist) from an
 * event that hasn't started. Their sign-up is deleted, so they can sign up again, and their
 * spot goes to the waitlist.
 */
export async function removeParticipant(
  guild: Guild,
  eventId: string,
  signUpId: string,
  by: { id: string },
  now = new Date(),
): Promise<SignUpChanges> {
  return transaction(async () => {
    const event = await openEvent(guild, eventId, now);
    const signUp = await SignUp.findOne({
      where: { id: signUpId, eventId: event.id, placement: { [Op.ne]: null } },
    });
    if (!signUp) throw new DomainError({ code: 'NOT_FOUND' });
    await signUp.destroy();
    const changes = await balanceSlots(event);
    changes.removed.push({ memberId: signUp.memberId, eventId: event.id, byUserId: by.id });
    return changes;
  });
}

/**
 * The Guild Master or an Officer replaces a Tentative participant with any waitlisted
 * character of the same role: they swap, and the Tentative participant goes to the end of the
 * waitlist.
 */
export async function replaceTentative(
  guild: Guild,
  eventId: string,
  signUpId: string,
  replacementId: string,
  now = new Date(),
): Promise<SignUpChanges> {
  return transaction(async () => {
    const event = await openEvent(guild, eventId, now);
    const [target, replacement] = await Promise.all([
      SignUp.findOne({ where: { id: signUpId, eventId: event.id } }),
      SignUp.findOne({ where: { id: replacementId, eventId: event.id } }),
    ]);
    if (!target || !replacement) throw new DomainError({ code: 'NOT_FOUND' });
    if (target.placement !== 'slot' || target.status !== 'tentative') {
      throw new DomainError({ code: 'SIGN_UP_NOT_TENTATIVE' });
    }
    if (replacement.placement !== 'waitlist' || replacement.role !== target.role) {
      throw new DomainError({ code: 'NOT_ON_WAITLIST' });
    }
    await target.update({ placement: 'waitlist', signedUpAt: now });
    await replacement.update({ placement: 'slot' });
    return {
      ...noSignUpChanges(),
      promoted: [replacement.id],
      replaced: [target.id],
    };
  });
}

/** The guild's event, locked; it must not have started or been cancelled. */
async function openEvent(guild: Guild, eventId: string, now: Date): Promise<Event> {
  if (!uuidSchema.safeParse(eventId).success) throw new DomainError({ code: 'NOT_FOUND' });
  const event = await Event.findOne({
    where: { id: eventId, guildId: guild.id },
    lock: Transaction.LOCK.UPDATE,
  });
  if (!event) throw new DomainError({ code: 'NOT_FOUND' });
  if (event.cancelledAt) throw new DomainError({ code: 'EVENT_CANCELLED' });
  if (event.startsAt <= now) throw new DomainError({ code: 'EVENT_STARTED' });
  return event;
}

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
  | {
      result: 'signed_up';
      event: Event;
      character: Character;
      placement: SignUpPlacement;
      /** Others promoted into the slot they left by changing role. */
      changes: SignUpChanges;
    }
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
      return {
        result: 'signed_up',
        event,
        character,
        placement: current.placement,
        changes: noSignUpChanges(),
      };
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
    // Leaving a slot in another role opens it for that role's waitlist.
    const changes = current?.placement === 'slot' ? await balanceSlots(event) : noSignUpChanges();
    return { result: 'signed_up', event, character, placement, changes };
  });
}

export type DeclineOutcome =
  | { result: 'declined'; event: Event; wasSignedUp: boolean; changes: SignUpChanges }
  | SignUpRefusal;

/**
 * The member won't come. Their sign-up becomes Declined, which releases their spot to the
 * earliest waitlisted character of that role. If they weren't signed up, a Declined sign-up with their main
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
      const hadSlot = current.placement === 'slot';
      await current.update({ status: 'declined', placement: null });
      const changes = hadSlot ? await balanceSlots(event) : noSignUpChanges();
      return { result: 'declined', event, wasSignedUp, changes };
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
    return { result: 'declined', event, wasSignedUp: false, changes: noSignUpChanges() };
  });
}

/** The event's sign-ups with their characters, slots before the waitlist, each by sign-up time. */
export async function eventSignUps(eventId: string): Promise<SignUp[]> {
  return SignUp.findAll({
    where: { eventId },
    include: [
      {
        model: Character,
        as: 'character',
        attributes: ['id', 'name', 'characterClass', 'race'],
      },
    ],
    order: [
      ['signedUpAt', 'ASC'],
      ['id', 'ASC'],
    ],
  });
}

function slotsOf(event: Event): Record<CombatRole, number> {
  return { tank: event.tankSlots, healer: event.healerSlots, dps: event.dpsSlots };
}

function slotsFor(event: Event, role: CombatRole): number {
  return slotsOf(event)[role];
}

/** The event's participants (in a slot or on the waitlist), for telling them about a change. */
export async function participantIds(eventId: string): Promise<string[]> {
  const signUps = await SignUp.findAll({
    attributes: ['memberId'],
    where: { eventId, placement: { [Op.ne]: null } },
  });
  return signUps.map((signUp) => signUp.memberId);
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
