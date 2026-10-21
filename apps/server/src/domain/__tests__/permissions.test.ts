import { describe, expect, it } from 'vitest';

import { can, PERMISSIONS, type GuildAction } from '../permissions.js';

// One row per action, from the App permissions table in requirements.md.
const table: Record<GuildAction, { guildMaster: boolean; officer: boolean }> = {
  viewGuild: { guildMaster: true, officer: true },
  connectDiscordServer: { guildMaster: true, officer: false },
  chooseOfficerRole: { guildMaster: true, officer: false },
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
