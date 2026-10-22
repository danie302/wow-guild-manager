import { z } from 'zod';

import { COMBAT_ROLES, type CombatRole } from '../game.js';

export const EVENT_TYPES = ['raid', 'dungeon', 'pvp'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_NAME_MAX_LENGTH = 100;
export const EVENT_DESCRIPTION_MAX_LENGTH = 2000;

/** Raids are 10, 20, or 40 players. */
export const RAID_SIZES = [10, 20, 40] as const;
/** Dungeons are always 5: 1 Tank, 1 Healer, and 3 DPS. */
export const DUNGEON_SLOTS = { tank: 1, healer: 1, dps: 3 } as const;
export const PVP_MIN_SIZE = 1;
export const PVP_MAX_SIZE = 80;

/** Error codes for the event rules, used as issue messages like the character ones. */
export const EVENT_ERROR_CODES = {
  /** A raid's size isn't 10, 20, or 40. */
  invalidRaidSize: 'INVALID_RAID_SIZE',
  /** A dungeon's slots aren't 1 Tank, 1 Healer, and 3 DPS. */
  dungeonSlotsFixed: 'DUNGEON_SLOTS_FIXED',
  /** The Tank, Healer, and DPS slots don't add up to the size. */
  slotsDontAddUp: 'SLOTS_DONT_ADD_UP',
  /** The start time has already passed. */
  startsInPast: 'EVENT_STARTS_IN_PAST',
  /** Pre-confirmed participants on something other than a one-time raid. */
  preConfirmedNotAllowed: 'PRE_CONFIRMED_NOT_ALLOWED',
  /** More pre-confirmed participants in a role than it has slots. */
  preConfirmedRoleFull: 'PRE_CONFIRMED_ROLE_FULL',
  /** The character isn't on the roster, or its member can't join raids. */
  preConfirmedCannotJoin: 'PRE_CONFIRMED_CANNOT_JOIN',
  /** The character's class can't fill that role. */
  preConfirmedRoleNotAllowed: 'PRE_CONFIRMED_ROLE_NOT_ALLOWED',
  /** Two characters of the same member. */
  preConfirmedTwice: 'PRE_CONFIRMED_TWICE',
} as const;

const slotCount = z.number().int().min(0).max(PVP_MAX_SIZE);

/** A Tentative deadline, in hours before the event (the guild's, or an event's own). */
export const TENTATIVE_DEADLINE_HOURS = { min: 1, max: 168, default: 24 } as const;
/** When the reminder goes out, in hours before the deadline. */
export const REMINDER_HOURS = { min: 1, max: 72, default: 12 } as const;

export const tentativeDeadlineHoursSchema = z
  .number()
  .int()
  .min(TENTATIVE_DEADLINE_HOURS.min)
  .max(TENTATIVE_DEADLINE_HOURS.max);

/** What can change on an event; the type is fixed when it's created. */
const eventDetails = {
  name: z.string().trim().min(1).max(EVENT_NAME_MAX_LENGTH),
  description: z.string().trim().max(EVENT_DESCRIPTION_MAX_LENGTH).default(''),
  /** In UTC, as an ISO date and time. The web app converts from the user's time zone. */
  startsAt: z.iso.datetime({ offset: true }),
  size: z.number().int().min(PVP_MIN_SIZE).max(PVP_MAX_SIZE),
  slots: z.object({ tank: slotCount, healer: slotCount, dps: slotCount }).strict(),
  /** Its own Tentative deadline; null (or left out) uses the guild's. */
  tentativeDeadlineHours: tentativeDeadlineHoursSchema.nullable().default(null),
};

type Details = { size: number; slots: { tank: number; healer: number; dps: number } };

/** Problems with the size and slots for an event type, by field ("size" or "slots"). */
export function eventSlotIssues(
  type: EventType,
  { size, slots: { tank, healer, dps } }: Details,
): { field: 'size' | 'slots'; code: (typeof EVENT_ERROR_CODES)[keyof typeof EVENT_ERROR_CODES] }[] {
  if (type === 'dungeon') {
    const fixed =
      size === 5 &&
      tank === DUNGEON_SLOTS.tank &&
      healer === DUNGEON_SLOTS.healer &&
      dps === DUNGEON_SLOTS.dps;
    return fixed ? [] : [{ field: 'slots', code: EVENT_ERROR_CODES.dungeonSlotsFixed }];
  }
  const issues: ReturnType<typeof eventSlotIssues> = [];
  if (type === 'raid' && !(RAID_SIZES as readonly number[]).includes(size)) {
    issues.push({ field: 'size', code: EVENT_ERROR_CODES.invalidRaidSize });
  }
  if (tank + healer + dps !== size) {
    issues.push({ field: 'slots', code: EVENT_ERROR_CODES.slotsDontAddUp });
  }
  return issues;
}

/** A participant the Guild Master pre-confirms when creating a raid: a character and its role. */
export const preConfirmedSchema = z
  .object({ characterId: z.uuid(), role: z.enum(COMBAT_ROLES) })
  .strict();

export type PreConfirmedInput = z.infer<typeof preConfirmedSchema>;

/**
 * Body of `POST /api/guilds/:guildId/events`. `preConfirmed` is only for one-time raids, and
 * only the Guild Master can send it; the server checks each character.
 */
export const createEventSchema = z
  .object({
    type: z.enum(EVENT_TYPES),
    ...eventDetails,
    preConfirmed: z.array(preConfirmedSchema).max(PVP_MAX_SIZE).optional(),
  })
  .strict()
  .superRefine((event, ctx) => {
    for (const { field, code } of eventSlotIssues(event.type, event)) {
      ctx.addIssue({ code: 'custom', path: [field], message: code });
    }
    const preConfirmed = event.preConfirmed ?? [];
    if (preConfirmed.length === 0) return;
    if (event.type !== 'raid') {
      ctx.addIssue({
        code: 'custom',
        path: ['preConfirmed'],
        message: EVENT_ERROR_CODES.preConfirmedNotAllowed,
      });
      return;
    }
    for (const role of COMBAT_ROLES) {
      if (preConfirmed.filter((p) => p.role === role).length > event.slots[role]) {
        ctx.addIssue({
          code: 'custom',
          path: ['preConfirmed'],
          message: EVENT_ERROR_CODES.preConfirmedRoleFull,
        });
        return;
      }
    }
  });

/**
 * Body of `PUT /api/guilds/:guildId/events/:eventId`: everything but the type, which can't
 * change. The server checks the slots against the event's type.
 */
export const updateEventSchema = z.object(eventDetails).strict();

/**
 * A weekly series ("MC every Tuesday") is created with the same body as an event: `startsAt`
 * is its first event, and the rest follow every 7 days at the same UTC time.
 */
export const SERIES_WEEKS_AHEAD = 2;

export type CreateEventInput = z.input<typeof createEventSchema>;
export type UpdateEventInput = z.input<typeof updateEventSchema>;

/** Which events `GET /api/guilds/:guildId/events` returns. */
export const eventListQuerySchema = z.union([
  /** Not started yet, soonest first; or started, most recent first. */
  z.object({ scope: z.enum(['upcoming', 'past']) }).strict(),
  /** Starting in a time range (e.g. a calendar month), in order. */
  z
    .object({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) })
    .strict(),
]);

/** A sign-up's status. Declined releases the spot. */
export const SIGN_UP_STATUSES = ['confirmed', 'tentative', 'declined'] as const;
export type SignUpStatus = (typeof SIGN_UP_STATUSES)[number];

/** Where a sign-up that isn't Declined stands: in one of the role's slots, or on its waitlist. */
export const SIGN_UP_PLACEMENTS = ['slot', 'waitlist'] as const;
export type SignUpPlacement = (typeof SIGN_UP_PLACEMENTS)[number];

/** What `signUpsLosingSlots` needs from a sign-up. */
export interface SlotHolder {
  id: string;
  role: CombatRole | null;
  placement: SignUpPlacement | null;
  /** ISO string or Date: the order of sign-up. */
  signedUpAt: string | Date;
}

/**
 * The sign-ups that lose their slot when a role's slots go down to `slots`: the most recent
 * ones in each role. They move to the front of the waitlist. The event form uses it to warn
 * before saving, and the server to apply it.
 */
export function signUpsLosingSlots<T extends SlotHolder>(
  signUps: readonly T[],
  slots: Record<CombatRole, number>,
): T[] {
  return COMBAT_ROLES.flatMap((role) => {
    const holders = signUps
      .filter((signUp) => signUp.role === role && signUp.placement === 'slot')
      .sort(
        (a, b) =>
          new Date(a.signedUpAt).getTime() - new Date(b.signedUpAt).getTime() ||
          a.id.localeCompare(b.id),
      );
    return holders.slice(slots[role]);
  });
}

/** Body of `POST /api/guilds/:guildId/events/:eventId/sign-ups/:signUpId/replace`. */
export const replaceParticipantSchema = z.object({ replacementId: z.uuid() }).strict();
