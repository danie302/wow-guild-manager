import { describe, expect, it } from 'vitest';

import { createGuildSchema, GUILD_ERROR_CODES, guildNameSchema } from '../guild.js';

const valid = {
  name: 'Ashen Vanguard',
  faction: 'alliance',
  discordServerId: '613425648685547541',
  officerRoleId: '613425648685547542',
} as const;

describe('guildNameSchema', () => {
  it('trims the name', () => {
    expect(guildNameSchema.parse('  Ashen Vanguard ')).toBe('Ashen Vanguard');
  });

  it('accepts 1 to 50 characters', () => {
    expect(guildNameSchema.safeParse('A').success).toBe(true);
    expect(guildNameSchema.safeParse('A'.repeat(50)).success).toBe(true);
  });

  it.each(['', '   ', 'A'.repeat(51)])('rejects "%s"', (name) => {
    expect(guildNameSchema.safeParse(name).success).toBe(false);
  });

  it('rejects offensive words with NAME_NOT_ALLOWED', () => {
    const result = guildNameSchema.safeParse('Los Pendejos');
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      GUILD_ERROR_CODES.nameNotAllowed,
    ]);
  });
});

describe('createGuildSchema', () => {
  it('accepts a valid guild', () => {
    expect(createGuildSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['an unknown faction', { faction: 'scourge' }],
    ['a server ID that is not a Discord ID', { discordServerId: 'my-server' }],
    ['a role ID that is too short', { officerRoleId: '123' }],
    ['unknown fields', { guildMasterId: 1 }],
  ])('rejects %s', (_case, change) => {
    expect(createGuildSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});
