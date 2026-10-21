import { z } from 'zod';

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
} as const;

const slotCount = z.number().int().min(0).max(PVP_MAX_SIZE);

/** What can change on an event; the type is fixed when it's created. */
const eventDetails = {
  name: z.string().trim().min(1).max(EVENT_NAME_MAX_LENGTH),
  description: z.string().trim().max(EVENT_DESCRIPTION_MAX_LENGTH).default(''),
  /** In UTC, as an ISO date and time. The web app converts from the user's time zone. */
  startsAt: z.iso.datetime({ offset: true }),
  size: z.number().int().min(PVP_MIN_SIZE).max(PVP_MAX_SIZE),
  slots: z.object({ tank: slotCount, healer: slotCount, dps: slotCount }).strict(),
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

/** Body of `POST /api/guilds/:guildId/events`. */
export const createEventSchema = z
  .object({ type: z.enum(EVENT_TYPES), ...eventDetails })
  .strict()
  .superRefine((event, ctx) => {
    for (const { field, code } of eventSlotIssues(event.type, event)) {
      ctx.addIssue({ code: 'custom', path: [field], message: code });
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
