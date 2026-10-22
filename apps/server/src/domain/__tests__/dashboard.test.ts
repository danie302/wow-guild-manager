import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestGuild } from '../../../test/test-guild.js';
import {
  Character,
  Event,
  Member,
  Registration,
  SignUp,
  User,
  type Guild,
} from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { dashboard } from '../dashboard.js';

const serverId = '300000000000000001';
const hour = 60 * 60 * 1000;
const now = new Date('2026-10-22T12:00:00Z');

let sequelize: Sequelize;
let guild: Guild;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
  const gm = await User.create({ discordId: '200000000000000001', name: 'Garrosh', avatar: null });
  guild = await createTestGuild(gm, { serverId });
});

function event(name: string, hoursAway: number, deadlineHours = 24) {
  const startsAt = new Date(now.getTime() + hoursAway * hour);
  return Event.create({
    guildId: guild.id,
    type: 'pvp',
    name,
    description: '',
    startsAt,
    tentativeDeadlineAt: new Date(startsAt.getTime() - deadlineHours * hour),
    size: 2,
    tankSlots: 1,
    healerSlots: 0,
    dpsSlots: 1,
    createdByUserId: null,
  });
}

async function member(name: string, extra: Partial<Member> = {}) {
  const created = await Member.create({
    guildId: guild.id,
    discordUserId: `2000000000000001${name.length}${name.charCodeAt(0)}`.slice(0, 18),
    discordName: name,
    discordAvatar: null,
    rank: 'raider',
    ...extra,
  });
  const character = await Character.create({
    memberId: created.id,
    name,
    faction: 'horde',
    race: 'orc',
    characterClass: 'warrior',
    level: 60,
    professions: [],
    isMain: true,
  });
  return { member: created, character };
}

describe('dashboard', () => {
  it('shows what needs attention', async () => {
    const soon = await event('Soon', 30);
    await event('Next week', 24 * 7);
    await event('Far', 24 * 20);
    const thrall = await member('Thrall');
    await SignUp.create({
      eventId: soon.id,
      memberId: thrall.member.id,
      characterId: thrall.character.id,
      role: 'tank',
      status: 'tentative',
      placement: 'slot',
      signedUpAt: now,
    });
    await member('Gone', { leftDiscordAt: new Date(now.getTime() - hour) });
    await Registration.create({
      guildId: guild.id,
      discordUserId: '200000000000000777',
      discordName: 'Newcomer',
      discordAvatar: null,
      locale: 'en',
    });

    const result = await dashboard(guild, now);

    expect(result.upcoming.map((e) => [e.name, e.filled])).toEqual([
      ['Soon', { tank: 1, healer: 0, dps: 0 }],
      ['Next week', { tank: 0, healer: 0, dps: 0 }],
      ['Far', { tank: 0, healer: 0, dps: 0 }],
    ]);
    // Only events within 8 days are checked for missing roles.
    expect(result.missingRoles.map((e) => [e.name, e.missing])).toEqual([
      ['Soon', { tank: 0, healer: 0, dps: 1 }],
      ['Next week', { tank: 1, healer: 0, dps: 1 }],
    ]);
    // Soon's deadline is 6 hours away; Next week's is days away.
    expect(result.tentative).toMatchObject([
      { eventName: 'Soon', character: { name: 'Thrall' }, role: 'tank' },
    ]);
    expect(result.registrations).toMatchObject([{ discordName: 'Newcomer' }]);
    expect(result.leftDiscord).toMatchObject([
      { discordName: 'Gone', rank: 'raider', main: { name: 'Gone' } },
    ]);
  });
});
