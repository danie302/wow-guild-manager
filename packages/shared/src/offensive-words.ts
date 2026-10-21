import { Profanity, profaneWords } from '@2toad/profanity';

/** The languages names are checked in. Add a code the package supports to check another one. */
export const OFFENSIVE_WORD_LANGUAGES = ['en', 'es'] as const;

/** Lowercase, without accents ("Cabrón" → "cabron"). */
function withoutAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase();
}

/**
 * Words the package's lists miss (its Spanish list is short), written without accents because
 * names are also checked without accents. Words with an innocent meaning too ("concha",
 * "polla", "zorra") are left out. Add more here when one gets through.
 */
const EXTRA_WORDS = [
  ...withPlurals(['pendejo', 'pendeja', 'cabron', 'cabrona', 'marica', 'maricon', 'joto']),
  ...withPlurals(['culero', 'culera', 'mamon', 'mamona', 'pajero', 'pajera', 'malparido']),
  ...withPlurals(['malparida', 'hijueputa', 'gonorrea', 'verga', 'pinga', 'chingada']),
  ...withPlurals(['puto', 'putito', 'putita', 'mierda', 'carajo', 'malnacido', 'malnacida']),
  'gilipollas',
  'chingar',
  'chinga',
  'chingate',
  'chingatumadre',
  'mamaguevo',
  'mamahuevo',
  'hijo de perra',
  'hijos de perra',
  'concha de tu madre',
  'me cago en',
  'tu puta madre',
];

/** Kept with its "ñ": without it, it's "cono" (cone). */
const EXTRA_WORDS_WITH_ACCENTS = ['coño', 'coños'];

function withPlurals(words: string[]): string[] {
  return words.flatMap((word) => [word, word.endsWith('n') ? `${word}es` : `${word}s`]);
}

const filter = new Profanity({
  languages: [...OFFENSIVE_WORD_LANGUAGES],
  // Whole words only, with Unicode boundaries, so "vehículo" doesn't match "culo".
  wholeWord: true,
  unicodeWordBoundaries: true,
});

// The package's lists keep their accents, so they miss "cabron" for "cabrón". Their words
// without accents are added too, and names are checked as written and without accents.
filter.addWords([
  ...OFFENSIVE_WORD_LANGUAGES.flatMap((language) => profaneWords.get(language) ?? []).map(
    withoutAccents,
  ),
  ...EXTRA_WORDS,
  ...EXTRA_WORDS_WITH_ACCENTS,
]);

/**
 * Whether a name people chose contains an offensive word in English or Spanish. It matches
 * whole words, ignoring case and accents. It doesn't catch every trick (e.g. "f.u.c.k").
 */
export function hasOffensiveWords(text: string): boolean {
  return filter.exists(text) || filter.exists(withoutAccents(text));
}
