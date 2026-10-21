import { describe, expect, it } from 'vitest';

import {
  ADMINISTRATOR,
  MANAGE_GUILD,
  role,
  server,
} from '../../../../test/fake-discord-directory.js';
import { canManageServer, discordRoleColor, officerRoleOptions } from '../directory.js';

const userId = '200000000000000001';

describe('canManageServer', () => {
  const guild = server('300000000000000001', 'Ashen Vanguard', {
    roles: [
      role('400000000000000001', 'Admins', { permissions: ADMINISTRATOR }),
      role('400000000000000002', 'Managers', { permissions: MANAGE_GUILD }),
      role('400000000000000003', 'Raiders'),
    ],
  });

  it.each([
    ['Administrator', ['400000000000000001']],
    ['Manage Server', ['400000000000000002', '400000000000000003']],
  ])('allows a member with a role that has %s', (_case, roleIds) => {
    expect(canManageServer(guild, userId, { roleIds })).toBe(true);
  });

  it('denies a member whose roles have neither permission', () => {
    expect(canManageServer(guild, userId, { roleIds: ['400000000000000003'] })).toBe(false);
  });

  it('allows the server owner without any role', () => {
    expect(canManageServer({ ...guild, ownerId: userId }, userId, { roleIds: [] })).toBe(true);
  });

  it('counts the permissions of @everyone', () => {
    const open = {
      ...guild,
      roles: guild.roles.map((r) => (r.id === guild.id ? { ...r, permissions: MANAGE_GUILD } : r)),
    };
    expect(canManageServer(open, userId, { roleIds: [] })).toBe(true);
  });
});

describe('officerRoleOptions', () => {
  it('leaves out @everyone and managed roles, highest first', () => {
    const guild = server('300000000000000001', 'Ashen Vanguard', {
      roles: [
        role('400000000000000001', 'Raiders', { position: 1 }),
        role('400000000000000002', 'Officers', { position: 3 }),
        role('400000000000000003', 'Guild Manager bot', { position: 2, managed: true }),
      ],
    });
    expect(officerRoleOptions(guild).map((r) => r.name)).toEqual(['Officers', 'Raiders']);
  });
});

describe('discordRoleColor', () => {
  it('turns the color into CSS hex, and 0 into no color', () => {
    expect(discordRoleColor(role('1', 'Officers', { color: 0x00ff0a }))).toBe('#00ff0a');
    expect(discordRoleColor(role('1', 'Officers'))).toBeNull();
  });
});
