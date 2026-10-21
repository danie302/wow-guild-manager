import { describe, expect, it } from 'vitest';

import { can, canChangeRankOf, canRemove, PERMISSIONS, type GuildAction } from '../permissions.js';

// One row per action, from the App permissions table in requirements.md.
const table: Record<GuildAction, { guildMaster: boolean; officer: boolean }> = {
  viewGuild: { guildMaster: true, officer: true },
  editGuildProfile: { guildMaster: true, officer: false },
  connectDiscordServer: { guildMaster: true, officer: false },
  chooseOfficerRole: { guildMaster: true, officer: false },
  viewRoster: { guildMaster: true, officer: true },
  addCharacters: { guildMaster: true, officer: true },
  changeMemberRank: { guildMaster: true, officer: true },
  removeAnyMember: { guildMaster: true, officer: false },
  removeRaidersAndMembers: { guildMaster: true, officer: true },
  officerNotes: { guildMaster: true, officer: true },
  changeMainCharacter: { guildMaster: true, officer: true },
  editCharacters: { guildMaster: true, officer: true },
};

describe('permissions', () => {
  it('has a row in this test for every action', () => {
    expect(Object.keys(table).sort()).toEqual(Object.keys(PERMISSIONS).sort());
  });

  it.each(Object.entries(table) as [GuildAction, (typeof table)[GuildAction]][])(
    '%s',
    (action, allowed) => {
      expect(can('guild_master', action)).toBe(allowed.guildMaster);
      expect(can('officer', action)).toBe(allowed.officer);
      expect(can(null, action)).toBe(false);
    },
  );
});

describe('acting on a member', () => {
  it.each([
    ['guild_master', 'officer', true],
    ['guild_master', 'raider', true],
    ['officer', 'raider', true],
    ['officer', 'member', true],
    ['officer', 'officer', false],
    ['officer', 'guild_master', false],
  ] as const)('%s changing the rank of, or removing, a %s: %s', (access, target, allowed) => {
    expect(canChangeRankOf(access, target)).toBe(allowed);
    expect(canRemove(access, target)).toBe(allowed);
  });
});
