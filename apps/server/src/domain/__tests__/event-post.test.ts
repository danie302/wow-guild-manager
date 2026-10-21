import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Event } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { eventPostEmbed } from '../event-post.js';

// 2026-11-03 20:00 UTC, and its Tentative deadline 24 hours before.
const startsAt = new Date('2026-11-03T20:00:00Z');
const unix = startsAt.getTime() / 1000;
const deadline = unix - 24 * 60 * 60;

let sequelize: Sequelize;

// Building an Event needs the models set up; nothing is saved.
beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

function event(extra: Partial<Event> = {}) {
  return Event.build({
    guildId: '00000000-0000-7000-8000-000000000001',
    type: 'raid',
    name: 'Blackwing Lair',
    description: 'Bring Onyxia cloaks.',
    startsAt,
    size: 40,
    tankSlots: 4,
    healerSlots: 10,
    dpsSlots: 26,
    createdByUserId: null,
    cancelledAt: null,
    ...extra,
  });
}

describe('eventPostEmbed', () => {
  it('shows the name, description, local time, slots, and Tentative deadline', () => {
    expect(eventPostEmbed(event(), 'en')).toEqual({
      title: 'Blackwing Lair',
      description: 'Bring Onyxia cloaks.',
      color: 0xdcae55,
      fields: [
        { name: 'Date', value: `<t:${unix}:F> (<t:${unix}:R>)` },
        { name: 'Tank (0/4)', value: '—', inline: true },
        { name: 'Healer (0/10)', value: '—', inline: true },
        { name: 'DPS (0/26)', value: '—', inline: true },
        { name: 'Waitlist', value: 'Empty' },
        { name: 'Sign-ups', value: `Tentative sign-ups close <t:${deadline}:F>.` },
      ],
    });
  });

  it('is written in the given language, with game terms in English', () => {
    const embed = eventPostEmbed(event(), 'es');

    expect(embed.fields.map((field) => field.name)).toEqual([
      'Fecha',
      'Tank (0/4)',
      'Healer (0/10)',
      'DPS (0/26)',
      'Lista de espera',
      'Inscripciones',
    ]);
    expect(embed.fields.at(-1)?.value).toBe(
      `Las inscripciones provisionales cierran el <t:${deadline}:F>.`,
    );
  });

  it('leaves out roles without slots and an empty description', () => {
    const embed = eventPostEmbed(
      event({ description: '', size: 5, tankSlots: 0, healerSlots: 0, dpsSlots: 5 }),
      'en',
    );

    expect(embed.description).toBeUndefined();
    expect(embed.fields.map((field) => field.name)).toEqual([
      'Date',
      'DPS (0/5)',
      'Waitlist',
      'Sign-ups',
    ]);
  });

  it('marks a cancelled event and drops the Tentative deadline', () => {
    const embed = eventPostEmbed(event({ cancelledAt: new Date() }), 'en');

    expect(embed.title).toBe('~~Blackwing Lair~~');
    expect(embed.description).toBe('**This event has been cancelled.**\n\nBring Onyxia cloaks.');
    expect(embed.color).toBe(0x80848e);
    expect(embed.fields.map((field) => field.name)).not.toContain('Sign-ups');
  });
});
