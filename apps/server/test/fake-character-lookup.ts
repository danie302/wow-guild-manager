import type {
  CharacterEquipment,
  CharacterLookup,
  CharacterProfile,
  CharacterRef,
  LookupResult,
} from '../src/integrations/character-lookup/character-lookup.js';

/**
 * The game in memory: characters with their profile and equipment. Names match without regard
 * to case, as in the game. A character without equipment set has every slot empty.
 */
export class FakeCharacterLookup implements CharacterLookup {
  readonly profiles = new Map<string, CharacterProfile>();
  readonly equipments = new Map<string, CharacterEquipment>();
  /** Set to make every lookup answer "unavailable" as if the API were failing. */
  down = false;
  /** The `fetchedAt` of every result. */
  fetchedAt = new Date('2026-11-05T12:00:00Z');
  calls = 0;

  addCharacter(profile: CharacterProfile, equipment?: CharacterEquipment): this {
    const key = profile.name.toLowerCase();
    this.profiles.set(key, profile);
    if (equipment) this.equipments.set(key, equipment);
    return this;
  }

  profile(character: CharacterRef): Promise<LookupResult<CharacterProfile>> {
    return this.lookup(character, (key) => this.profiles.get(key));
  }

  equipment(character: CharacterRef): Promise<LookupResult<CharacterEquipment>> {
    return this.lookup(character, (key) => this.equipments.get(key) ?? { items: [] });
  }

  private lookup<T>(
    character: CharacterRef,
    read: (key: string) => T | undefined,
  ): Promise<LookupResult<T>> {
    this.calls++;
    if (this.down) return Promise.resolve({ status: 'unavailable', reason: 'error' });
    const key = character.name.toLowerCase();
    if (!this.profiles.has(key)) {
      return Promise.resolve({ status: 'not_found', fetchedAt: this.fetchedAt });
    }
    const data = read(key) as T;
    return Promise.resolve({ status: 'found', data, fetchedAt: this.fetchedAt });
  }
}
