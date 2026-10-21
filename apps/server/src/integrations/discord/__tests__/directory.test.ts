import { describe, expect, it } from 'vitest';

import {
  ADMINISTRATOR,
  channel,
  EMBED_LINKS,
  MANAGE_GUILD,
  POST_PERMISSIONS,
  role,
  SEND_MESSAGES,
  server,
  VIEW_CHANNEL,
} from '../../../../test/fake-discord-directory.js';
import {
  canManageServer,
  channelPermissions,
  discordRoleColor,
  eventChannelOptions,
  officerRoleOptions,
} from '../directory.js';

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

describe('channelPermissions', () => {
  const serverId = '300000000000000001';
  const botRole = '400000000000000010';
  const otherRole = '400000000000000011';
  const bot = { id: '100000000000000099', roleIds: [botRole] };
  const guild = server(serverId, 'Ashen Vanguard', {
    roles: [role(botRole, 'Bot', { permissions: POST_PERMISSIONS }), role(otherRole, 'Other')],
  });

  it('starts from the roles of the member and @everyone', () => {
    expect(channelPermissions(guild, channel('1', 'raids'), bot)).toBe(POST_PERMISSIONS);
  });

  it('applies @everyone, then the roles together, then the member', () => {
    const everyoneDenies = { id: serverId, type: 'role', allow: 0n, deny: VIEW_CHANNEL } as const;
    const roleAllows = { id: botRole, type: 'role', allow: VIEW_CHANNEL, deny: 0n } as const;
    const memberDenies = { id: bot.id, type: 'member', allow: 0n, deny: EMBED_LINKS } as const;

    const hidden = channel('1', 'officers', { overwrites: [everyoneDenies] });
    expect(channelPermissions(guild, hidden, bot) & VIEW_CHANNEL).toBe(0n);

    const shown = channel('1', 'raids', { overwrites: [everyoneDenies, roleAllows] });
    expect(channelPermissions(guild, shown, bot) & VIEW_CHANNEL).toBe(VIEW_CHANNEL);

    const noEmbeds = channel('1', 'raids', { overwrites: [roleAllows, memberDenies] });
    expect(channelPermissions(guild, noEmbeds, bot)).toBe(VIEW_CHANNEL | SEND_MESSAGES);
  });

  it("lets one role's allow win over another role's deny", () => {
    const overwrites = [
      { id: otherRole, type: 'role', allow: 0n, deny: SEND_MESSAGES },
      { id: botRole, type: 'role', allow: SEND_MESSAGES, deny: 0n },
    ] as const;
    const member = { id: bot.id, roleIds: [botRole, otherRole] };
    expect(
      channelPermissions(guild, channel('1', 'raids', { overwrites: [...overwrites] }), member) &
        SEND_MESSAGES,
    ).toBe(SEND_MESSAGES);
  });

  it('allows everything to an Administrator, whatever the overwrites', () => {
    const admin = server(serverId, 'Ashen Vanguard', {
      roles: [role(botRole, 'Bot', { permissions: ADMINISTRATOR })],
    });
    const hidden = channel('1', 'officers', {
      overwrites: [{ id: botRole, type: 'role', allow: 0n, deny: VIEW_CHANNEL }],
    });
    expect(channelPermissions(admin, hidden, bot) & POST_PERMISSIONS).toBe(POST_PERMISSIONS);
  });
});

describe('eventChannelOptions', () => {
  it("lists text channels where the bot can post, in Discord's order", () => {
    const botRole = '400000000000000010';
    const guild = server('300000000000000001', 'Ashen Vanguard', {
      roles: [role(botRole, 'Bot', { permissions: POST_PERMISSIONS })],
    });
    const bot = { id: '100000000000000099', roleIds: [botRole] };
    const channels = [
      channel('10', 'Raiding', { type: 'category', position: 1 }),
      channel('11', 'Social', { type: 'category', position: 0 }),
      channel('1', 'raid-signups', { parentId: '10', position: 1 }),
      channel('2', 'announcements', { parentId: '10', position: 0, type: 'announcement' }),
      channel('3', 'general', { parentId: '11' }),
      channel('4', 'welcome', { position: 5 }),
      channel('5', 'Voice', { type: 'other' }),
      channel('6', 'officers', {
        overwrites: [{ id: botRole, type: 'role', allow: 0n, deny: SEND_MESSAGES }],
      }),
    ];

    expect(
      eventChannelOptions(guild, channels, bot).map(
        ({ channel: c, category }) => `${category?.name ?? '-'}/${c.name}`,
      ),
    ).toEqual(['-/welcome', 'Social/general', 'Raiding/announcements', 'Raiding/raid-signups']);
  });
});
