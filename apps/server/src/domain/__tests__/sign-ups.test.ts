import type { CharacterClass } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestGuild } from '../../../test/test-guild.js';
import { Character, Member, SignUp, User, type Event, type Guild } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { cancelEvent, createEvent } from '../events.js';
import { decline, eventSignUps, signUp, signUpContext } from '../sign-ups.js';

const serverId = '300000000000000001';
const day = 24 * 60 * 60 * 1000;

let sequelize: Sequelize;
let gm: User;
let guild: Guild;
let discordIds = 200000000000000100n;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
  gm = await User.create({ discordId: '200000000000000001', name: 'Garrosh', avatar: null });
  guild = await createTestGuild(gm, { serverId });
});

/** A roster member with characters (the first is the main), all Orcs of the given classes. */
async function member(classes: CharacterClass[], rank: 'raider' | 'member' = 'raider') {
  const discordUserId = String(discordIds++);
  const created = await Member.create({
    guildId: guild.id,
    discordUserId,
    discordName: `Player ${discordUserId.slice(-3)}`,
    discordAvatar: null,
    rank,
  });
  const characters = [];
  for (const [index, characterClass] of classes.entries()) {
    characters.push(
      await Character.create({
        memberId: created.id,
        name: `Char${discordUserId.slice(-3)}${index}`,
        faction: 'horde',
        race: 'orc',
        characterClass,
        level: 60,
        professions: [],
        isMain: index === 0,
      }),
    );
  }
  return { member: created, discordUserId, characters };
}

function event(type: 'raid' | 'dungeon' = 'raid', slots = { tank: 1, healer: 1, dps: 3 }) {
  return createEvent(
    guild,
    {
      type,
      name: type === 'raid' ? 'Zul’Gurub' : 'Stratholme',
      description: '',
      startsAt: new Date(Date.now() + 3 * day).toISOString(),
      size: type === 'raid' ? 20 : 5,
      slots: type === 'raid' ? { tank: 2, healer: 4, dps: 14 } : slots,
    },
    gm,
  );
}

const placements = async (target: Event) =>
  (await eventSignUps(target.id)).map((s) => [s.character!.name, s.role, s.status, s.placement]);

describe('signUp', () => {
  it('gives a free slot, then puts the rest on the waitlist in order', async () => {
    const dungeon = await event('dungeon');
    const first = await member(['warrior']);
    const second = await member(['warrior']);

    const a = await signUp(serverId, first.discordUserId, dungeon.id, {
      characterId: first.characters[0]!.id,
      role: 'tank',
      status: 'confirmed',
    });
    const b = await signUp(serverId, second.discordUserId, dungeon.id, {
      characterId: second.characters[0]!.id,
      role: 'tank',
      status: 'tentative',
    });

    expect([
      a.result === 'signed_up' && a.placement,
      b.result === 'signed_up' && b.placement,
    ]).toEqual(['slot', 'waitlist']);
    expect(await placements(dungeon)).toEqual([
      [first.characters[0]!.name, 'tank', 'confirmed', 'slot'],
      [second.characters[0]!.name, 'tank', 'tentative', 'waitlist'],
    ]);
  });

  it('gives the last slot to exactly one of 10 parallel sign-ups', async () => {
    const dungeon = await event('dungeon', { tank: 1, healer: 1, dps: 3 });
    const players = await Promise.all(Array.from({ length: 10 }, () => member(['warrior'])));

    await Promise.all(
      players.map((player) =>
        signUp(serverId, player.discordUserId, dungeon.id, {
          characterId: player.characters[0]!.id,
          role: 'tank',
          status: 'confirmed',
        }),
      ),
    );

    const rows = await SignUp.findAll({ where: { eventId: dungeon.id } });
    expect(rows.filter((row) => row.placement === 'slot')).toHaveLength(1);
    expect(rows.filter((row) => row.placement === 'waitlist')).toHaveLength(9);
  });

  it('keeps the spot when only the status or the character changes', async () => {
    const dungeon = await event('dungeon');
    const holder = await member(['warrior', 'druid']);
    const waiting = await member(['warrior']);
    const sign = (who: typeof holder, characterIndex: number, status: 'confirmed' | 'tentative') =>
      signUp(serverId, who.discordUserId, dungeon.id, {
        characterId: who.characters[characterIndex]!.id,
        role: 'tank',
        status,
      });
    await sign(holder, 0, 'tentative');
    await sign(waiting, 0, 'confirmed');

    await sign(holder, 0, 'confirmed');
    await sign(holder, 1, 'confirmed');

    expect(await placements(dungeon)).toEqual([
      [holder.characters[1]!.name, 'tank', 'confirmed', 'slot'],
      [waiting.characters[0]!.name, 'tank', 'confirmed', 'waitlist'],
    ]);
  });

  it('treats a new role as a new sign-up, losing the spot if that role is full', async () => {
    const dungeon = await event('dungeon', { tank: 1, healer: 1, dps: 3 });
    const druid = await member(['druid']);
    const priest = await member(['priest']);
    await signUp(serverId, priest.discordUserId, dungeon.id, {
      characterId: priest.characters[0]!.id,
      role: 'healer',
      status: 'confirmed',
    });
    await signUp(serverId, druid.discordUserId, dungeon.id, {
      characterId: druid.characters[0]!.id,
      role: 'tank',
      status: 'confirmed',
    });

    const moved = await signUp(serverId, druid.discordUserId, dungeon.id, {
      characterId: druid.characters[0]!.id,
      role: 'healer',
      status: 'confirmed',
    });

    expect(moved.result === 'signed_up' && moved.placement).toBe('waitlist');
    expect(await SignUp.count({ where: { eventId: dungeon.id } })).toBe(2);
  });

  it("refuses a role the character's class can't fill", async () => {
    const dungeon = await event('dungeon');
    const mage = await member(['mage']);

    const outcome = await signUp(serverId, mage.discordUserId, dungeon.id, {
      characterId: mage.characters[0]!.id,
      role: 'tank',
      status: 'confirmed',
    });

    expect(outcome.result).toBe('role_not_allowed');
  });

  it("refuses someone else's character", async () => {
    const dungeon = await event('dungeon');
    const mine = await member(['warrior']);
    const theirs = await member(['warrior']);

    const outcome = await signUp(serverId, mine.discordUserId, dungeon.id, {
      characterId: theirs.characters[0]!.id,
      role: 'tank',
      status: 'confirmed',
    });

    expect(outcome.result).toBe('not_your_character');
  });
});

describe('who can sign up', () => {
  it('lets Members join dungeons but not raids', async () => {
    const raid = await event('raid');
    const dungeon = await event('dungeon');
    const { discordUserId } = await member(['warrior'], 'member');

    expect((await signUpContext(serverId, discordUserId, raid.id)).result).toBe('not_eligible');
    expect((await signUpContext(serverId, discordUserId, dungeon.id)).result).toBe('ok');
  });

  it('sends people who are not on the roster to /register', async () => {
    const raid = await event();

    const outcome = await signUpContext(serverId, '200000000000000999', raid.id);

    expect(outcome).toMatchObject({ result: 'not_on_roster', guild: { name: guild.name } });
  });

  it('refuses members flagged as having left Discord, and those without characters', async () => {
    const raid = await event();
    const left = await member(['warrior']);
    await left.member.update({ leftDiscordAt: new Date() });
    const empty = await member([]);

    expect((await signUpContext(serverId, left.discordUserId, raid.id)).result).toBe(
      'left_discord',
    );
    expect((await signUpContext(serverId, empty.discordUserId, raid.id)).result).toBe(
      'no_characters',
    );
  });

  it('closes sign-ups when the event starts or is cancelled', async () => {
    const raid = await event();
    const player = await member(['warrior']);

    const afterStart = await signUp(
      serverId,
      player.discordUserId,
      raid.id,
      { characterId: player.characters[0]!.id, role: 'tank', status: 'confirmed' },
      new Date(Date.now() + 4 * day),
    );
    await cancelEvent(guild, raid.id, gm);
    const afterCancel = await decline(serverId, player.discordUserId, raid.id);

    expect([afterStart.result, afterCancel.result]).toEqual(['closed', 'closed']);
  });

  it('lists the characters main first', async () => {
    const dungeon = await event('dungeon');
    const player = await member(['warrior', 'druid', 'mage']);

    const context = await signUpContext(serverId, player.discordUserId, dungeon.id);

    expect(context.result === 'ok' && context.characters[0]!.isMain).toBe(true);
  });
});

describe('decline', () => {
  it('releases the spot of someone signed up', async () => {
    const dungeon = await event('dungeon');
    const player = await member(['warrior']);
    await signUp(serverId, player.discordUserId, dungeon.id, {
      characterId: player.characters[0]!.id,
      role: 'tank',
      status: 'confirmed',
    });

    const outcome = await decline(serverId, player.discordUserId, dungeon.id);

    expect(outcome).toMatchObject({ result: 'declined', wasSignedUp: true });
    expect(await placements(dungeon)).toEqual([
      [player.characters[0]!.name, 'tank', 'declined', null],
    ]);
  });

  it('records a Declined sign-up with the main of someone who was not signed up', async () => {
    const dungeon = await event('dungeon');
    const player = await member(['warrior', 'mage']);

    const outcome = await decline(serverId, player.discordUserId, dungeon.id);

    expect(outcome).toMatchObject({ result: 'declined', wasSignedUp: false });
    expect(await placements(dungeon)).toEqual([
      [player.characters[0]!.name, null, 'declined', null],
    ]);
  });

  it('signs up again after declining, as a new sign-up', async () => {
    const dungeon = await event('dungeon');
    const player = await member(['warrior']);
    await decline(serverId, player.discordUserId, dungeon.id);

    const outcome = await signUp(serverId, player.discordUserId, dungeon.id, {
      characterId: player.characters[0]!.id,
      role: 'dps',
      status: 'tentative',
    });

    expect(outcome.result === 'signed_up' && outcome.placement).toBe('slot');
  });
});
