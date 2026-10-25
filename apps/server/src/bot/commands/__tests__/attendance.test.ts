import type { ChatInputCommandInteraction } from 'discord.js';
import { MessageFlags } from 'discord.js';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestGuild } from '../../../../test/test-guild.js';
import {
  Attendance,
  Character,
  Event,
  User,
  type Guild,
  type Member,
} from '../../../db/models/index.js';
import { createSequelize } from '../../../db/sequelize.js';
import { addMember } from '../../../domain/roster.js';
import { translator } from '../../../i18n/index.js';
import { attendance } from '../attendance.js';

const serverId = '300000000000000001';
const thrall = { discordUserId: '200000000000000002', discordName: 'Thrall', discordAvatar: null };
const day = 24 * 60 * 60 * 1000;

let sequelize: Sequelize;
let guild: Guild;
let member: Member;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
  const gm = await User.create({ discordId: '200000000000000001', name: 'Garrosh', avatar: null });
  guild = await createTestGuild(gm, { serverId, name: 'Orgrimmar Guard' });
  ({ member } = await addMember(guild, thrall, 'raider', gm, [
    { name: 'Thrall', faction: 'horde', race: 'orc', class: 'shaman', level: 60, professions: [] },
  ]));
});

/** An event `daysAgo`, with Thrall's attendance. */
async function attended(daysAgo: number, status: 'present' | 'no_show', type = 'raid' as const) {
  const startsAt = new Date(Date.now() - daysAgo * day);
  const event = await Event.create({
    guildId: guild.id,
    type,
    name: `Molten Core ${daysAgo}`,
    description: '',
    startsAt,
    tentativeDeadlineAt: startsAt,
    size: 10,
    tankSlots: 1,
    healerSlots: 2,
    dpsSlots: 7,
    createdByUserId: null,
  });
  const character = (await Character.findOne({ where: { memberId: member.id } }))!;
  await Attendance.create({
    eventId: event.id,
    memberId: member.id,
    characterId: character.id,
    status,
  });
}

async function run(userId = thrall.discordUserId, locale: 'en' | 'es' = 'en') {
  const reply = vi.fn<(options: unknown) => Promise<void>>(() => Promise.resolve());
  const command = {
    guildId: serverId,
    inGuild: () => true,
    user: { id: userId },
    reply,
  } as unknown as ChatInputCommandInteraction;
  await attendance.execute(command, { locale, t: translator(locale) });
  return reply.mock.calls[0]![0] as {
    content?: string;
    embeds?: { title: string; fields: { name: string; value: string }[] }[];
    flags: number;
  };
}

describe('/attendance', () => {
  it('shows the last 8 weeks and all time, per type, and the latest events, only to them', async () => {
    await attended(3, 'present');
    await attended(10, 'no_show');
    await attended(100, 'present');

    const answer = await run();

    expect(answer.flags).toBe(MessageFlags.Ephemeral);
    const [embed] = answer.embeds!;
    expect(embed!.title).toBe('Your attendance in Orgrimmar Guard');
    expect(embed!.fields.map((field) => [field.name, field.value])).toEqual([
      ['Last 8 weeks', '50% (1 of 2) · At risk'],
      ['All time', '67% (2 of 3)'],
      ['By event type (last 8 weeks)', 'Raid: 50% (1 of 2)\nDungeon: —\nPvP: —'],
      ['Last 8 weeks', 'Late: 0 · Bench: 0 · No-shows: 1'],
      ['Latest events', expect.stringContaining('**Molten Core 3** – Present') as string],
    ]);
  });

  it('says so when they have no records yet, or are not on the roster', async () => {
    expect((await run()).content).toBe(
      'You have no attendance records in Orgrimmar Guard yet. They appear after the events you sign up for.',
    );
    expect((await run('200000000000000099')).content).toBe(
      "You aren't on the roster of Orgrimmar Guard, so you have no attendance records. Use /register to ask to join.",
    );
  });
});
