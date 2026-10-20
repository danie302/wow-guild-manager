import { SUPPORTED_LOCALES, type Locale } from '@wgm/shared';
import { Locale as DiscordLocale, type LocalizationMap } from 'discord.js';

import { DEFAULT_LOCALE, translator, type TranslationKey } from '../i18n/index.js';

/** Our locale for a Discord locale ("es-ES", "es-419", "en-US"…), if we support it. */
export function fromDiscordLocale(discordLocale: string | null | undefined): Locale | undefined {
  const language = discordLocale?.split('-')[0];
  return SUPPORTED_LOCALES.find((locale) => locale === language);
}

/**
 * The locale for a reply only one member sees: their Discord language if we support it,
 * otherwise the guild's language.
 */
export function replyLocale(options: {
  interactionLocale: string | null | undefined;
  guildLocale?: Locale | undefined;
}): Locale {
  return fromDiscordLocale(options.interactionLocale) ?? options.guildLocale ?? DEFAULT_LOCALE;
}

/**
 * The locale for a direct message: the language of the member's most recent interaction with
 * the bot, otherwise the guild's language.
 */
export function directMessageLocale(options: {
  lastUsedLocale?: Locale | undefined;
  guildLocale?: Locale | undefined;
}): Locale {
  return options.lastUsedLocale ?? options.guildLocale ?? DEFAULT_LOCALE;
}

/** Discord locales that get each of our non-default locales. */
const DISCORD_LOCALES: Record<Exclude<Locale, typeof DEFAULT_LOCALE>, DiscordLocale[]> = {
  es: [DiscordLocale.SpanishES, DiscordLocale.SpanishLATAM],
};

/** A translation for every Discord locale we support, for command names and descriptions. */
export function discordLocalizations(key: TranslationKey): LocalizationMap {
  const map: LocalizationMap = {};
  for (const [locale, discordLocales] of Object.entries(DISCORD_LOCALES) as [
    Locale,
    DiscordLocale[],
  ][]) {
    const text = translator(locale)(key);
    for (const discordLocale of discordLocales) {
      map[discordLocale] = text;
    }
  }
  return map;
}
