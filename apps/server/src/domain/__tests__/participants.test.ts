import type { CharacterClass, CombatRole } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestGuild } from '../../../test/test-guild.js';
import { Character, Member, SignUp, User, type Event, type Guild } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { DomainError, DomainValidationError } from '../errors.js';
import { createEvent } from '../events.js';
import { removeParticipant, replaceTentative, signUp } from '../sign-ups.js';

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

async function player(characterClass: CharacterClass, rank: 'raider' | 'member' = 'raider') {
  const discordUserId = String(discordIds++);
  const member = await Member.create({
    guildId: guild.id,
    discordUserId,
    discordName: `Player ${discordUserId.slice(-3)}`,
    discordAvatar: null,
    rank,
  });
  const character = await Character.create({
    memberId: member.id,
    name: `Char${discordUserId.slice(-3)}`,
    faction: 'horde',
    race: 'orc',
    characterClass,
    level: 60,
    professions: [],
    isMain: true,
  });
  return { member, discordUserId, character };
}

type Player = Awaited<ReturnType<typeof player>>;

function raid(preConfirmed: { characterId: string; role: CombatRole }[] = []) {
  return createEvent(
    guild,
    {
      type: 'raid',
      name: 'Zul’Gurub',
      description: '',
      startsAt: new Date(Date.now() + 3 * day).toISOString(),
      size: 20,
      slots: { tank: 1, healer: 5, dps: 14 },
      preConfirmed,
    },
    gm,
  );
}

async function join(
  who: Player,
  event: Event,
  role: CombatRole,
  status: 'confirmed' | 'tentative',
) {
  const outcome = await signUp(serverId, who.discordUserId, event.id, {
    characterId: who.character.id,
    role,
    status,
  });
  if (outcome.result !== 'signed_up') throw new Error(outcome.result);
  return (await SignUp.findOne({ where: { eventId: event.id, memberId: who.member.id } }))!;
}

describe('removeParticipant', () => {
  it('deletes the sign-up and gives the spot to the waitlist', async () => {
    const event = await raid();
    const [a, b] = [await player('warrior'), await player('warrior')];
    const removed = await join(a, event, 'tank', 'confirmed');
    const waiting = await join(b, event, 'tank', 'confirmed');

    const changes = await removeParticipant(guild, event.id, removed.id, gm);

    expect(changes.promoted).toEqual([waiting.id]);
    expect(changes.removed).toEqual([
      { memberId: a.member.id, eventId: event.id, byUserId: gm.id },
    ]);
    expect(await SignUp.count({ where: { eventId: event.id } })).toBe(1);
  });

  it('refuses once the event has started', async () => {
    const event = await raid();
    const signUpRow = await join(await player('warrior'), event, 'tank', 'confirmed');

    await expect(
      removeParticipant(guild, event.id, signUpRow.id, gm, new Date(Date.now() + 4 * day)),
    ).rejects.toEqual(new DomainError({ code: 'EVENT_STARTED' }));
  });
});

describe('replaceTentative', () => {
  it('swaps a Tentative participant with any waitlisted character of the role', async () => {
    const event = await raid();
    const [holder, first, second] = [
      await player('warrior'),
      await player('warrior'),
      await player('warrior'),
    ];
    const tentative = await join(holder, event, 'tank', 'tentative');
    const firstWaiting = await join(first, event, 'tank', 'confirmed');
    const chosen = await join(second, event, 'tank', 'confirmed');

    const changes = await replaceTentative(guild, event.id, tentative.id, chosen.id);

    expect(changes).toMatchObject({ promoted: [chosen.id], replaced: [tentative.id] });
    const rows = await SignUp.findAll({
      where: { eventId: event.id, placement: 'waitlist' },
      order: [['signedUpAt', 'ASC']],
    });
    expect(rows.map((row) => row.id)).toEqual([firstWaiting.id, tentative.id]);
  });

  it('refuses to replace a Confirmed participant, or with someone not on that waitlist', async () => {
    const event = await raid();
    const confirmed = await join(await player('warrior'), event, 'tank', 'confirmed');
    const waiting = await join(await player('warrior'), event, 'tank', 'confirmed');
    const healer = await join(await player('priest'), event, 'healer', 'tentative');

    await expect(replaceTentative(guild, event.id, confirmed.id, waiting.id)).rejects.toEqual(
      new DomainError({ code: 'SIGN_UP_NOT_TENTATIVE' }),
    );
    await expect(replaceTentative(guild, event.id, healer.id, waiting.id)).rejects.toEqual(
      new DomainError({ code: 'NOT_ON_WAITLIST' }),
    );
  });
});

describe('pre-confirmed participants', () => {
  it('start as Confirmed in a slot', async () => {
    const tank = await player('warrior');

    const event = await raid([{ characterId: tank.character.id, role: 'tank' }]);

    expect(await SignUp.findAll({ where: { eventId: event.id } })).toMatchObject([
      { memberId: tank.member.id, role: 'tank', status: 'confirmed', placement: 'slot' },
    ]);
  });

  it.each([
    ['a Member, who cannot join raids', 'member', 'tank', 'PRE_CONFIRMED_CANNOT_JOIN'],
    ['a role the class cannot fill', 'raider', 'healer', 'PRE_CONFIRMED_ROLE_NOT_ALLOWED'],
  ] as const)('refuses %s', async (_case, rank, role, code) => {
    const warrior = await player('warrior', rank);

    const error = await raid([{ characterId: warrior.character.id, role }]).catch(
      (err: unknown) => err,
    );

    expect(error).toEqual(new DomainValidationError([{ field: 'preConfirmed.0', code }]));
  });

  it('refuses more than a role has slots, and the same member twice', async () => {
    const [a, b] = [await player('warrior'), await player('warrior')];

    const full = await raid([
      { characterId: a.character.id, role: 'tank' },
      { characterId: b.character.id, role: 'tank' },
    ]).catch((err: unknown) => err);
    const twice = await raid([
      { characterId: a.character.id, role: 'tank' },
      { characterId: a.character.id, role: 'dps' },
    ]).catch((err: unknown) => err);

    expect(full).toBeInstanceOf(DomainValidationError);
    expect(twice).toEqual(
      new DomainValidationError([{ field: 'preConfirmed.1', code: 'PRE_CONFIRMED_TWICE' }]),
    );
  });
});
