import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Event, type SignUp } from '../../db/models/index.js';
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
    tentativeDeadlineAt: new Date(startsAt.getTime() - 24 * 60 * 60 * 1000),
    size: 40,
    tankSlots: 4,
    healerSlots: 10,
    dpsSlots: 26,
    createdByUserId: null,
    cancelledAt: null,
    ...extra,
  });
}

const signUp = (
  name: string,
  role: string | null,
  placement: string | null,
  status = 'confirmed',
) =>
  ({
    role,
    placement,
    status,
    character: { name, characterClass: 'warrior' },
  }) as unknown as SignUp;

const none = { signUps: [], leader: 'Thrall' };

describe('eventPostEmbed', () => {
  it('shows a header, a column per role, the waitlist, and the Tentative deadline', () => {
    expect(eventPostEmbed(event(), 'en', none)).toEqual({
      title: 'Blackwing Lair',
      description: 'Bring Onyxia cloaks.',
      color: 0xdcae55,
      fields: [
        { name: '\u200b', value: `🚩 Thrall\n📅 <t:${unix}:D>`, inline: true },
        { name: '\u200b', value: `👥 **0**\n🕐 <t:${unix}:t>`, inline: true },
        { name: '\u200b', value: `\u200b\n⏳ <t:${unix}:R>`, inline: true },
        { name: '\u200b', value: '🛡️ __**Tank**__ (0/4)\n—', inline: true },
        { name: '\u200b', value: '➕ __**Healer**__ (0/10)\n—', inline: true },
        { name: '\u200b', value: '⚔️ __**DPS**__ (0/26)\n—', inline: true },
        { name: 'Waitlist (0)', value: 'Empty' },
        { name: 'Sign-ups', value: `Tentative sign-ups close <t:${deadline}:F>.` },
      ],
    });
  });

  it('is written in the given language, with game terms in English', () => {
    const embed = eventPostEmbed(event(), 'es', none);

    expect(embed.fields.map((field) => field.name).slice(-2)).toEqual([
      'Lista de espera (0)',
      'Inscripciones',
    ]);
    expect(embed.fields[3]?.value).toBe('🛡️ __**Tank**__ (0/4)\n—');
    expect(embed.fields.at(-1)?.value).toBe(
      `Las inscripciones provisionales cierran el <t:${deadline}:F>.`,
    );
  });

  it('leaves out roles without slots and an empty description', () => {
    const embed = eventPostEmbed(
      event({ description: '', size: 5, tankSlots: 0, healerSlots: 0, dpsSlots: 5 }),
      'en',
      none,
    );

    expect(embed.description).toBeUndefined();
    expect(embed.fields.filter((field) => field.value.includes('__**'))).toHaveLength(1);
  });

  it('marks a cancelled event and drops the Tentative deadline', () => {
    const embed = eventPostEmbed(event({ cancelledAt: new Date() }), 'en', none);

    expect(embed.title).toBe('~~Blackwing Lair~~');
    expect(embed.description).toBe('**This event has been cancelled.**\n\nBring Onyxia cloaks.');
    expect(embed.color).toBe(0x80848e);
    expect(embed.fields.map((field) => field.name)).not.toContain('Sign-ups');
  });

  it('numbers the sign-ups across the event, with class icons and Tentative marked', () => {
    const embed = eventPostEmbed(event(), 'en', {
      signUps: [
        signUp('Thrall', 'tank', 'slot'),
        signUp('Cairne', 'dps', null, 'declined'),
        signUp('Jaina', 'healer', 'slot', 'tentative'),
        signUp('Rexxar', 'tank', 'waitlist'),
      ],
      leader: null,
      emojis: {
        classes: { warrior: '<:wgm_warrior:1>' },
        roles: { tank: 'T', healer: 'H', dps: 'D' },
      },
    });

    expect(embed.fields.map((field) => field.value)).toEqual([
      `🚩 —\n📅 <t:${unix}:D>`,
      `👥 **3**\n🕐 <t:${unix}:t>`,
      `\u200b\n⏳ <t:${unix}:R>`,
      'T __**Tank**__ (1/4)\n<:wgm_warrior:1> `1` **Thrall**',
      'H __**Healer**__ (1/10)\n<:wgm_warrior:1> `2` **Jaina** *(tentative)*',
      'D __**DPS**__ (0/26)\n—',
      'T <:wgm_warrior:1> `3` **Rexxar**',
      'Cairne',
      `Tentative sign-ups close <t:${deadline}:F>.`,
    ]);
    expect(embed.fields[6]?.name).toBe('Waitlist (1)');
    expect(embed.fields[7]?.name).toBe('Declined (1)');
  });

  it("cuts a role's list short to fit Discord's field limit", () => {
    const many = Array.from({ length: 80 }, (_, index) =>
      signUp(`Character${String(index).padStart(2, '0')}xxxxxxxx`, 'dps', 'slot'),
    );

    const field = eventPostEmbed(
      event({ size: 80, tankSlots: 0, healerSlots: 0, dpsSlots: 80, type: 'pvp' }),
      'en',
      { signUps: many, leader: 'Thrall' },
    ).fields[3]!;

    expect(field.value.length).toBeLessThanOrEqual(1024);
    expect(field.value).toMatch(/^⚔️ __\*\*DPS\*\*__ \(80\/80\)\n/);
    expect(field.value).toMatch(/…and \d+ more$/);
  });
});
