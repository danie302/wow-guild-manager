export * from './api.js';
export * from './game.js';
export * from './schemas/character.js';

export const SUPPORTED_LOCALES = ['en', 'es'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
