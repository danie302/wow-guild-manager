import type { CharacterLookup } from './character-lookup.js';

/** Used while there's no Battle.net client: every lookup is "unavailable". */
export const unavailableCharacterLookup: CharacterLookup = {
  profile() {
    return Promise.resolve({ status: 'unavailable', reason: 'not_configured' });
  },
  equipment() {
    return Promise.resolve({ status: 'unavailable', reason: 'not_configured' });
  },
};
