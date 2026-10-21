import type { CreateEventInput } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestGuild } from '../../../test/test-guild.js';
import {
  Character,
  Event,
  Member,
  SignUp,
  User,
  type EventSeries,
  type Guild,
} from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { createTestLogger } from '../../test-logger.js';
import { DomainError } from '../errors.js';
import { cancelEvent, updateEvent } from '../events.js';
import { createSeries, extendAllSeries, stopSeries, updateSeries } from '../series.js';

const day = 24 * 60 * 60 * 1000;
// A Sunday; the series starts the following Tuesday.
const now = new Date('2026-11-01T12:00:00Z');
const mc: CreateEventInput = {
  type: 'raid',
  name: 'Molten Core',
  description: '',
  startsAt: '2026-11-03T19:00:00Z',
  size: 40,
  slots: { tank: 4, healer: 10, dps: 26 },
};
const details = {
  name: 'Molten Core',
  description: '',
  size: 40,
  slots: { tank: 4, healer: 10, dps: 26 },
};

let sequelize: Sequelize;
let gm: User;
let guild: Guild;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
  gm = await User.create({ discordId: '200000000000000001', name: 'Garrosh', avatar: null });
  guild = await createTestGuild(gm, { serverId: '300000000000000001' });
});

async function eventsOf(series: EventSeries) {
  const events = await Event.findAll({
    where: { seriesId: series.id },
    order: [['startsAt', 'ASC']],
  });
  return events.map((event) => [
    event.startsAt.toISOString(),
    event.name,
    event.cancelledAt !== null,
  ]);
}

describe('createSeries', () => {
  it('creates its events every 7 days at the same UTC time, two weeks ahead', async () => {
    const series = await createSeries(guild, mc, gm, now);

    expect(await eventsOf(series)).toEqual([
      ['2026-11-03T19:00:00.000Z', 'Molten Core', false],
      ['2026-11-10T19:00:00.000Z', 'Molten Core', false],
    ]);
  });

  it('keeps two weeks ahead as time passes, without repeating events', async () => {
    const series = await createSeries(guild, mc, gm, now);
    const logger = createTestLogger().logger;

    await extendAllSeries(logger, new Date(now.getTime() + 10 * day));
    await extendAllSeries(logger, new Date(now.getTime() + 10 * day));

    expect((await eventsOf(series)).map(([at]) => at)).toEqual([
      '2026-11-03T19:00:00.000Z',
      '2026-11-10T19:00:00.000Z',
      '2026-11-17T19:00:00.000Z',
      '2026-11-24T19:00:00.000Z',
    ]);
  });
});

describe('updateSeries', () => {
  it('changes every future event, moving them to the new day and time', async () => {
    const series = await createSeries(guild, mc, gm, now);
    const [first] = await Event.findAll({
      where: { seriesId: series.id },
      order: [['startsAt', 'ASC']],
    });
    // Edited on its own, then overwritten by the series.
    await updateEvent(
      guild,
      first!.id,
      { ...details, name: 'MC (early)', startsAt: mc.startsAt },
      now,
    );

    await updateSeries(
      guild,
      series.id,
      { ...details, name: 'MC', startsAt: '2026-11-05T20:00:00Z' },
      now,
    );

    expect(await eventsOf(series)).toEqual([
      ['2026-11-05T20:00:00.000Z', 'MC', false],
      ['2026-11-12T20:00:00.000Z', 'MC', false],
    ]);
  });

  it('moves cancelled events too, but keeps them cancelled', async () => {
    const series = await createSeries(guild, mc, gm, now);
    const [first] = await Event.findAll({
      where: { seriesId: series.id },
      order: [['startsAt', 'ASC']],
    });
    await cancelEvent(guild, first!.id, gm, now);

    // A week later: the events swap into each other's times, in the right order.
    await updateSeries(
      guild,
      series.id,
      { ...details, name: 'MC', startsAt: '2026-11-10T19:00:00Z' },
      now,
    );

    expect(await eventsOf(series)).toEqual([
      ['2026-11-10T19:00:00.000Z', 'Molten Core', true],
      ['2026-11-17T19:00:00.000Z', 'MC', false],
    ]);
  });

  it('keeps past events as they were, and follows the rules of its type', async () => {
    const series = await createSeries(guild, mc, gm, now);
    const later = new Date('2026-11-04T12:00:00Z');

    await updateSeries(
      guild,
      series.id,
      { ...details, name: 'MC', startsAt: '2026-11-10T19:00:00Z' },
      later,
    );
    const error = await updateSeries(
      guild,
      series.id,
      { ...details, size: 25, startsAt: '2026-11-10T19:00:00Z' },
      later,
    ).catch((e: unknown) => e);

    expect((await eventsOf(series))[0]).toEqual(['2026-11-03T19:00:00.000Z', 'Molten Core', false]);
    expect(error).toMatchObject({
      issues: [
        { field: 'size', code: 'INVALID_RAID_SIZE' },
        { field: 'slots', code: 'SLOTS_DONT_ADD_UP' },
      ],
    });
  });
});

describe('stopSeries', () => {
  it('removes its future events, keeps the past ones, and stops creating more', async () => {
    const series = await createSeries(guild, mc, gm, now);
    const later = new Date('2026-11-04T12:00:00Z');

    await stopSeries(guild, series.id, gm, later);
    await extendAllSeries(createTestLogger().logger, new Date(later.getTime() + 30 * day));

    expect((await eventsOf(series)).map(([at]) => at)).toEqual(['2026-11-03T19:00:00.000Z']);
    await expect(stopSeries(guild, series.id, gm, later)).rejects.toEqual(
      new DomainError({ code: 'SERIES_STOPPED' }),
    );
  });

  it('keeps the future events that have sign-ups, other than Declined ones', async () => {
    const series = await createSeries(guild, mc, gm, now);
    const [first, second] = await Event.findAll({
      where: { seriesId: series.id },
      order: [['startsAt', 'ASC']],
    });
    const member = await Member.create({
      guildId: guild.id,
      discordUserId: '200000000000000050',
      discordName: 'Thrall',
      discordAvatar: null,
      rank: 'raider',
    });
    const character = await Character.create({
      memberId: member.id,
      name: 'Thrall',
      faction: 'horde',
      race: 'orc',
      characterClass: 'shaman',
      level: 60,
      professions: [],
      isMain: true,
    });
    const signUp = { memberId: member.id, characterId: character.id, signedUpAt: now };
    await SignUp.create({
      ...signUp,
      eventId: first!.id,
      role: 'healer',
      status: 'confirmed',
      placement: 'slot',
    });
    await SignUp.create({
      ...signUp,
      eventId: second!.id,
      role: null,
      status: 'declined',
      placement: null,
    });

    await stopSeries(guild, series.id, gm, new Date(first!.startsAt.getTime() - 1000));

    expect((await Event.findAll({ where: { seriesId: series.id } })).map((e) => e.id)).toEqual([
      first!.id,
    ]);
  });
});
