import type { CharacterClass, EquipmentSlot, Faction, Race } from '@wgm/shared';

import { unavailableCharacterLookup } from './unavailable-lookup.js';

/**
 * Reads characters from the game. Blizzard hasn't published a Battle.net API for World of
 * Warcraft: Forever yet, so every lookup answers "unavailable" until the real client exists
 * (story 037), and callers fall back to data entered by hand. Callers only use this interface,
 * so the client can be swapped without changing them. Lookups are slow and rate limited: call
 * them from background jobs, never from page requests. Tests use a fake.
 */
export interface CharacterLookup {
  /** The character's faction, race, class, and level. */
  profile(character: CharacterRef): Promise<LookupResult<CharacterProfile>>;
  /** What the character has equipped. */
  equipment(character: CharacterRef): Promise<LookupResult<CharacterEquipment>>;
}

/**
 * Which character to look up. Forever has no realms, so it's only the name for now; story 037
 * adds whatever else Blizzard's API turns out to need.
 */
export interface CharacterRef {
  name: string;
}

/**
 * "Not found" and "unavailable" are results, not exceptions, so callers must handle them.
 * `fetchedAt` is when the game data was read; it can be old, because the game only updates it
 * after the player logs out.
 */
export type LookupResult<T> =
  | { status: 'found'; data: T; fetchedAt: Date }
  | { status: 'not_found'; fetchedAt: Date }
  | { status: 'unavailable'; reason: LookupUnavailableReason };

/**
 * `not_configured`: there's no client (no API for Forever yet, or no credentials).
 * `error`: the API failed or kept rate limiting after the retries.
 */
export type LookupUnavailableReason = 'not_configured' | 'error';

export interface CharacterProfile {
  name: string;
  faction: Faction;
  race: Race;
  characterClass: CharacterClass;
  level: number;
}

export interface CharacterEquipment {
  /** One entry per equipped slot. An empty slot has no entry. */
  items: EquippedItem[];
}

export interface EquippedItem {
  slot: EquipmentSlot;
  itemId: number;
  name: string;
  itemLevel: number;
  /** The enchant's name, or null when the item has none. */
  enchant: string | null;
}

/** The lookup the processes use. Story 037 returns the Battle.net client when it's configured. */
export function createCharacterLookup(): CharacterLookup {
  return unavailableCharacterLookup;
}
