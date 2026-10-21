import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeJobQueue } from '../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../test/test-guild.js';
import { Character, Member, SignUp, User, type Event } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { createEvent } from '../../domain/events.js';
import { translator } from '../../i18n/index.js';
import { signUpHandler } from '../sign-up.js';

const serverId = '300000000000000001';
const playerId = '200000000000000002';
const context = { locale: 'en' as const, t: translator('en') };

let sequelize: Sequelize;
let event: Event;
let warrior: Character;
let mage: Character;
let jobs: FakeJobQueue;
let handler: ReturnType<typeof signUpHandler>;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
  const gm = await User.create({ discordId: '200000000000000001', name: 'Garrosh', avatar: null });
  const guild = await createTestGuild(gm, { serverId, name: 'Orgrimmar Guard' });
  event = await createEvent(
    guild,
    {
      type: 'dungeon',
      name: 'Stratholme',
      description: '',
      startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      size: 5,
      slots: { tank: 1, healer: 1, dps: 3 },
    },
    gm,
  );
  const member = await Member.create({
    guildId: guild.id,
    discordUserId: playerId,
    discordName: 'Thrall',
    discordAvatar: null,
    rank: 'raider',
  });
  const character = (name: string, characterClass: 'warrior' | 'mage', isMain: boolean) =>
    Character.create({
      memberId: member.id,
      name,
      faction: 'horde',
      race: 'orc',
      characterClass,
      level: 60,
      professions: [],
      isMain,
    });
  warrior = await character('Grommash', 'warrior', false);
  mage = await character('Thrall', 'mage', true);
  jobs = new FakeJobQueue();
  handler = signUpHandler(jobs);
});

function interaction(customId: string, values: string[] = [], userId = playerId) {
  return {
    customId,
    values,
    guildId: serverId,
    user: { id: userId },
    inGuild: () => true,
    reply: vi.fn(() => Promise.resolve()),
    update: vi.fn(() => Promise.resolve()),
  };
}

const click = (fake: ReturnType<typeof interaction>) =>
  handler.button!(fake as unknown as ButtonInteraction, context);
const choose = (fake: ReturnType<typeof interaction>) =>
  handler.select!(fake as unknown as StringSelectMenuInteraction, context);

/** The message the form was replied or updated with, as Discord's JSON. */
function sent(mock: ReturnType<typeof vi.fn>) {
  const [message] = mock.mock.lastCall as [
    { content: string; components: { toJSON(): { components: Record<string, unknown>[] } }[] },
  ];
  return {
    content: message.content,
    rows: message.components.map((row) => row.toJSON().components),
  };
}

describe('the sign-up form', () => {
  it('opens with the main picked, and its only role picked too', async () => {
    const open = interaction(`signup:open:${event.id}`);

    await click(open);

    const { content, rows } = sent(open.reply);
    expect(content).toContain('Sign up for **Stratholme**');
    const [characters, roles, buttons] = rows;
    expect(characters![0]!.options).toMatchObject([
      { label: 'Thrall', description: 'Mage · main', default: true },
      { label: 'Grommash', description: 'Warrior', default: false },
    ]);
    expect(roles![0]!.options).toMatchObject([{ label: 'DPS', value: 'dps', default: true }]);
    expect(buttons!.map((button) => [button.custom_id, button.disabled])).toEqual([
      [`signup:confirmed:${event.id}:${mage.id}:dps`, false],
      [`signup:tentative:${event.id}:${mage.id}:dps`, false],
    ]);
  });

  it('offers the roles of the chosen character, and waits for a role', async () => {
    const select = interaction(`signup:character:${event.id}:dps`, [warrior.id]);

    await choose(select);

    const [, roles, buttons] = sent(select.update).rows;
    expect(roles![0]!.options).toMatchObject([
      { value: 'tank', default: false },
      { value: 'dps', default: true },
    ]);
    expect(buttons![0]!.custom_id).toBe(`signup:confirmed:${event.id}:${warrior.id}:dps`);

    const noRole = interaction(`signup:character:${event.id}:-`, [warrior.id]);
    await choose(noRole);
    expect(sent(noRole.update).rows[2]!.every((button) => button.disabled)).toBe(true);
  });

  it('signs up, says where they stand, and schedules the post update', async () => {
    const submit = interaction(`signup:tentative:${event.id}:${warrior.id}:tank`);

    await click(submit);

    expect(submit.update).toHaveBeenCalledWith({
      content: "You're in: Grommash as Tank for Stratholme (Tentative).",
      components: [],
    });
    expect(await SignUp.count()).toBe(1);
    expect(jobs.payloads('event-post')).toEqual([{ eventId: event.id }]);
  });

  it('declines in one click', async () => {
    const declined = interaction(`signup:decline:${event.id}`);

    await click(declined);

    expect(declined.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Noted: you won't be at Stratholme." }),
    );
    expect(jobs.payloads('event-post')).toEqual([{ eventId: event.id }]);
  });

  it('sends someone who is not on the roster to /register', async () => {
    const open = interaction(`signup:open:${event.id}`, [], '200000000000000099');

    await click(open);

    expect(open.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "You're not on the Orgrimmar Guard roster. Use /register to ask to join.",
      }),
    );
    expect(jobs.jobs).toEqual([]);
  });
});
