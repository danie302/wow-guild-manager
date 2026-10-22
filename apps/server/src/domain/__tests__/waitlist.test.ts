import type { CharacterClass, CombatRole } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestGuild } from '../../../test/test-guild.js';
import { Character, Event, Member, SignUp, User, type Guild } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { createEvent, updateEvent } from '../events.js';
import { removeCharacter, removeMember } from '../roster.js';
import { createSeries, updateSeries } from '../series.js';
import { decline, signUp } from '../sign-ups.js';

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

/** A Raider with one character per class given (the first is the main). */
async function player(...classes: CharacterClass[]) {
  const discordUserId = String(discordIds++);
  const member = await Member.create({
    guildId: guild.id,
    discordUserId,
    discordName: `Player ${discordUserId.slice(-3)}`,
    discordAvatar: null,
    rank: 'raider',
  });
  const characters = [];
  for (const [index, characterClass] of classes.entries()) {
    characters.push(
      await Character.create({
        memberId: member.id,
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
  return { member, discordUserId, characters };
}

type Player = Awaited<ReturnType<typeof player>>;

const details = { name: 'Warsong Gulch', description: '' };
const sizeOf = (slots: Record<CombatRole, number>) => slots.tank + slots.healer + slots.dps;

/** A PvP event, whose slots can be anything (a dungeon's are fixed). */
function pvp(slots = { tank: 1, healer: 1, dps: 3 }, startsAt = Date.now() + 3 * day) {
  return createEvent(
    guild,
    {
      type: 'pvp',
      ...details,
      size: sizeOf(slots),
      startsAt: new Date(startsAt).toISOString(),
      slots,
    },
    gm,
  );
}

async function join(who: Player, event: Event, role: CombatRole, character = 0) {
  const outcome = await signUp(serverId, who.discordUserId, event.id, {
    characterId: who.characters[character]!.id,
    role,
    status: 'confirmed',
  });
  if (outcome.result !== 'signed_up') throw new Error(outcome.result);
  return outcome;
}

/** Each sign-up's member and placement, in sign-up order. */
async function standing(event: Event, players: Player[]) {
  const rows = await SignUp.findAll({
    where: { eventId: event.id },
    order: [['signedUpAt', 'ASC']],
  });
  return rows.map((row) => [players.findIndex((p) => p.member.id === row.memberId), row.placement]);
}

describe('promotion from the waitlist', () => {
  it('gives a declined spot to the earliest waitlisted character of that role', async () => {
    const event = await pvp();
    const [a, b, c] = [await player('warrior'), await player('warrior'), await player('warrior')];
    await join(a, event, 'tank');
    const second = await join(b, event, 'tank');
    await join(c, event, 'tank');

    const outcome = await decline(serverId, a.discordUserId, event.id);

    expect(outcome.result === 'declined' && outcome.changes.promoted).toEqual([
      (await SignUp.findOne({ where: { memberId: b.member.id } }))!.id,
    ]);
    expect(second.placement).toBe('waitlist');
    expect(await standing(event, [a, b, c])).toEqual([
      [0, null],
      [1, 'slot'],
      [2, 'waitlist'],
    ]);
  });

  it('frees the old spot when a participant changes to another role', async () => {
    const event = await pvp();
    const druid = await player('druid');
    const waiting = await player('warrior');
    await join(druid, event, 'tank');
    await join(waiting, event, 'tank');

    const moved = await join(druid, event, 'healer');

    expect(moved.changes.promoted).toHaveLength(1);
    expect(await standing(event, [druid, waiting])).toEqual([
      [1, 'slot'],
      [0, 'slot'],
    ]);
  });

  it('never fills more slots than the event has with parallel withdrawals and sign-ups', async () => {
    const event = await pvp({ tank: 2, healer: 1, dps: 2 });
    const holders = [await player('warrior'), await player('warrior')];
    for (const holder of holders) await join(holder, event, 'tank');
    const newcomers = await Promise.all(Array.from({ length: 8 }, () => player('warrior')));

    await Promise.all([
      ...holders.map((holder) => decline(serverId, holder.discordUserId, event.id)),
      ...newcomers.map((newcomer) => join(newcomer, event, 'tank')),
    ]);

    const rows = await SignUp.findAll({ where: { eventId: event.id, role: 'tank' } });
    expect(rows.filter((row) => row.placement === 'slot')).toHaveLength(2);
    expect(rows.filter((row) => row.placement === 'waitlist')).toHaveLength(6);
  });
});

describe('editing the slots', () => {
  it('moves the most recent participants to the front of the waitlist', async () => {
    const event = await pvp({ tank: 1, healer: 1, dps: 3 });
    const players = [await player('rogue'), await player('rogue'), await player('rogue')];
    for (const p of players) await join(p, event, 'dps');
    const waiting = await player('rogue');
    await join(waiting, event, 'dps');

    const { changes } = await updateEvent(guild, event.id, {
      ...details,
      startsAt: event.startsAt.toISOString(),
      size: 5,
      slots: { tank: 2, healer: 2, dps: 1 },
    });

    expect(changes.movedToWaitlist).toHaveLength(2);
    expect(await standing(event, [...players, waiting])).toEqual([
      [0, 'slot'],
      [1, 'waitlist'],
      [2, 'waitlist'],
      [3, 'waitlist'],
    ]);
  });

  it('promotes from the waitlist when a role gets more slots', async () => {
    const event = await pvp({ tank: 1, healer: 1, dps: 3 });
    const [a, b] = [await player('warrior'), await player('warrior')];
    await join(a, event, 'tank');
    await join(b, event, 'tank');

    const { changes } = await updateEvent(guild, event.id, {
      ...details,
      startsAt: event.startsAt.toISOString(),
      size: 5,
      slots: { tank: 2, healer: 1, dps: 2 },
    });

    expect(changes.promoted).toHaveLength(1);
    expect(await standing(event, [a, b])).toEqual([
      [0, 'slot'],
      [1, 'slot'],
    ]);
  });
});

describe('rescheduling', () => {
  it('lists the participants of an event whose time changed, but not who declined', async () => {
    const event = await pvp();
    const [inSlot, declined] = [await player('warrior'), await player('warrior')];
    await join(inSlot, event, 'tank');
    await decline(serverId, declined.discordUserId, event.id);
    const edit = { ...details, size: 5, slots: { tank: 1, healer: 1, dps: 3 } };

    const renamed = await updateEvent(guild, event.id, {
      ...edit,
      name: 'Scholomance',
      startsAt: event.startsAt.toISOString(),
    });
    const moved = await updateEvent(guild, event.id, {
      ...edit,
      startsAt: new Date(event.startsAt.getTime() + 60 * 60 * 1000).toISOString(),
    });

    expect(renamed.changes.rescheduled).toEqual([]);
    expect(moved.changes.rescheduled).toEqual([{ memberId: inSlot.member.id, eventId: event.id }]);
  });

  it('lists every changed event of a series edit', async () => {
    const series = await createSeries(
      guild,
      {
        type: 'pvp',
        ...details,
        size: 5,
        startsAt: new Date(Date.now() + day).toISOString(),
        slots: { tank: 1, healer: 1, dps: 3 },
      },
      gm,
    );
    const events = await Event.findAll({
      where: { seriesId: series.id },
      order: [['startsAt', 'ASC']],
    });
    const regular = await player('warrior');
    for (const event of events) await join(regular, event, 'tank');

    const { changes } = await updateSeries(guild, series.id, {
      ...details,
      startsAt: new Date(events[0]!.startsAt.getTime() + 60 * 60 * 1000).toISOString(),
      size: 5,
      slots: { tank: 1, healer: 1, dps: 3 },
    });

    expect(changes.rescheduled.map((entry) => entry.memberId)).toEqual(
      events.map(() => regular.member.id),
    );
  });
});

describe('leaving the roster', () => {
  it("removes a member's upcoming sign-ups, keeps past ones, and fills their spots", async () => {
    const upcoming = await pvp();
    const past = await pvp();
    const [leaving, waiting] = [await player('warrior'), await player('warrior')];
    await join(leaving, upcoming, 'tank');
    await join(waiting, upcoming, 'tank');
    await join(leaving, past, 'tank');
    await past.update({ startsAt: new Date(Date.now() - day) });

    const changes = await removeMember(leaving.member, guild);

    expect(changes.promoted).toHaveLength(1);
    expect(changes.eventIds).toEqual([upcoming.id]);
    expect(await standing(upcoming, [leaving, waiting])).toEqual([[1, 'slot']]);
    expect(await SignUp.count({ where: { eventId: past.id } })).toBe(1);
  });

  it("removes a removed character's upcoming sign-ups", async () => {
    const event = await pvp();
    const twoChars = await player('warrior', 'priest');
    const waiting = await player('priest');
    await join(twoChars, event, 'healer', 1);
    await join(waiting, event, 'healer');

    const { changes } = await removeCharacter(twoChars.member, twoChars.characters[1]!.id);

    expect(changes.promoted).toHaveLength(1);
    expect(await standing(event, [twoChars, waiting])).toEqual([[1, 'slot']]);
  });
});
