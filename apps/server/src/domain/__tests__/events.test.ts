import type { CreateEventInput } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestGuild } from '../../../test/test-guild.js';
import { User, type Guild } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { DomainError, DomainValidationError } from '../errors.js';
import { cancelEvent, createEvent, updateEvent } from '../events.js';

const now = new Date('2026-11-01T12:00:00Z');
const raid: CreateEventInput = {
  type: 'raid',
  name: 'Molten Core',
  description: '',
  startsAt: '2026-11-10T19:00:00Z',
  size: 40,
  slots: { tank: 4, healer: 10, dps: 26 },
};
const details = {
  name: raid.name,
  description: raid.description,
  startsAt: raid.startsAt,
  size: raid.size,
  slots: raid.slots,
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

const issuesOf = (error: unknown) => (error as DomainValidationError).issues;

describe('createEvent', () => {
  it('saves the event in UTC with who created it', async () => {
    const event = await createEvent(
      guild,
      { ...raid, startsAt: '2026-11-10T16:00:00-03:00' },
      gm,
      now,
    );

    expect(event).toMatchObject({
      type: 'raid',
      name: 'Molten Core',
      size: 40,
      tankSlots: 4,
      healerSlots: 10,
      dpsSlots: 26,
      createdByUserId: gm.id,
      cancelledAt: null,
    });
    expect(event.startsAt.toISOString()).toBe('2026-11-10T19:00:00.000Z');
  });

  it('refuses an event in the past', async () => {
    const error = await createEvent(
      guild,
      { ...raid, startsAt: '2026-10-31T19:00:00Z' },
      gm,
      now,
    ).catch((e: unknown) => e);

    expect(issuesOf(error)).toEqual([{ field: 'startsAt', code: 'EVENT_STARTS_IN_PAST' }]);
  });
});

describe('updateEvent', () => {
  it('changes everything but the type, with the rules of its type', async () => {
    const event = await createEvent(guild, raid, gm, now);

    const updated = await updateEvent(
      guild,
      event.id,
      { ...details, name: 'BWL', size: 20, slots: { tank: 2, healer: 5, dps: 13 } },
      now,
    );
    const error = await updateEvent(
      guild,
      event.id,
      { ...details, size: 15, slots: { tank: 2, healer: 3, dps: 10 } },
      now,
    ).catch((e: unknown) => e);

    expect(updated.event).toMatchObject({ name: 'BWL', type: 'raid', size: 20 });
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(issuesOf(error)).toEqual([{ field: 'size', code: 'INVALID_RAID_SIZE' }]);
  });

  it('refuses to change an event that started or was cancelled', async () => {
    const event = await createEvent(guild, raid, gm, now);
    const later = new Date('2026-11-10T19:00:00Z');

    await expect(updateEvent(guild, event.id, details, later)).rejects.toEqual(
      new DomainError({ code: 'EVENT_STARTED' }),
    );
    await cancelEvent(guild, event.id, gm, now);
    await expect(updateEvent(guild, event.id, details, now)).rejects.toEqual(
      new DomainError({ code: 'EVENT_CANCELLED' }),
    );
  });

  it("doesn't find another guild's event", async () => {
    const event = await createEvent(guild, raid, gm, now);
    const otherGm = await User.create({
      discordId: '200000000000000009',
      name: 'Vol',
      avatar: null,
    });
    const other = await createTestGuild(otherGm, { serverId: '300000000000000002' });

    await expect(updateEvent(other, event.id, details, now)).rejects.toEqual(
      new DomainError({ code: 'NOT_FOUND' }),
    );
  });
});

describe('cancelEvent', () => {
  it('keeps the event, marked with who cancelled it and when', async () => {
    const event = await createEvent(guild, raid, gm, now);

    const cancelled = await cancelEvent(guild, event.id, gm, now);

    expect(cancelled).toMatchObject({ cancelledAt: now, cancelledByUserId: gm.id });
    await expect(cancelEvent(guild, event.id, gm, now)).rejects.toEqual(
      new DomainError({ code: 'EVENT_CANCELLED' }),
    );
  });

  it("can't cancel an event that started", async () => {
    const event = await createEvent(guild, raid, gm, now);

    await expect(
      cancelEvent(guild, event.id, gm, new Date('2026-11-10T20:00:00Z')),
    ).rejects.toEqual(new DomainError({ code: 'EVENT_STARTED' }));
  });
});
