import { describe, expect, it } from 'vitest';

import { ping } from '../commands/ping.js';
import { directMessageLocale, fromDiscordLocale, replyLocale } from '../locale.js';

describe('fromDiscordLocale', () => {
  it('maps every regional variant of a supported language', () => {
    expect(fromDiscordLocale('es-ES')).toBe('es');
    expect(fromDiscordLocale('es-419')).toBe('es');
    expect(fromDiscordLocale('en-GB')).toBe('en');
    expect(fromDiscordLocale('pt-BR')).toBeUndefined();
    expect(fromDiscordLocale(undefined)).toBeUndefined();
  });
});

describe('replyLocale', () => {
  it("uses the member's Discord language, then the guild's, then English", () => {
    expect(replyLocale({ interactionLocale: 'es-ES', guildLocale: 'en' })).toBe('es');
    expect(replyLocale({ interactionLocale: 'de', guildLocale: 'es' })).toBe('es');
    expect(replyLocale({ interactionLocale: 'de' })).toBe('en');
  });
});

describe('directMessageLocale', () => {
  it("uses the member's last language, then the guild's, then English", () => {
    expect(directMessageLocale({ lastUsedLocale: 'es', guildLocale: 'en' })).toBe('es');
    expect(directMessageLocale({ guildLocale: 'es' })).toBe('es');
    expect(directMessageLocale({})).toBe('en');
  });
});

describe('command localizations', () => {
  it('gives /ping a Spanish description for both Spanish Discord locales', () => {
    expect(ping.definition.description).toBe('Check that the bot is online');
    expect(ping.definition.description_localizations).toEqual({
      'es-ES': 'Comprueba que el bot está en línea',
      'es-419': 'Comprueba que el bot está en línea',
    });
  });
});
