import type { CharacterInput } from '@wgm/shared';
import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestGuild } from '../../../../test/test-guild.js';
import { Character, User } from '../../../db/models/index.js';
import { createSequelize } from '../../../db/sequelize.js';
import { addMember } from '../../../domain/roster.js';
import { translator } from '../../../i18n/index.js';
import { character } from '../character.js';

const serverId = '300000000000000001';
const thrall = { discordUserId: '200000000000000002', discordName: 'Thrall', discordAvatar: null };
const shaman: CharacterInput = {
  name: 'Thrall',
  faction: 'horde',
  race: 'orc',
  class: 'shaman',
  level: 60,
  professions: [],
};

let sequelize: Sequelize;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
  const gm = await User.create({ discordId: '200000000000000001', name: 'Garrosh', avatar: null });
  const guild = await createTestGuild(gm, { serverId });
  await addMember(guild, thrall, 'raider', gm, [
    shaman,
    { ...shaman, name: 'Zuljin', race: 'troll', class: 'priest' },
  ]);
});

const context = { locale: 'en' as const, t: translator('en') };

/** Runs /character remove as Thrall, and returns the reply. */
async function ask(name: string) {
  const reply = vi.fn<(options: unknown) => Promise<void>>(() => Promise.resolve());
  const interaction = {
    guildId: serverId,
    inGuild: () => true,
    user: { id: thrall.discordUserId },
    options: { getString: () => name },
    reply,
  } as unknown as ChatInputCommandInteraction;
  await character.execute(interaction, context);
  return reply.mock.calls[0]![0] as {
    content: string;
    components?: { toJSON(): { components: { custom_id: string }[] } }[];
  };
}

/** Clicks a button as `userId`, and returns the new text of the question. */
async function click(customId: string, userId = thrall.discordUserId) {
  const update = vi.fn<(options: unknown) => Promise<void>>(() => Promise.resolve());
  const interaction = {
    customId,
    guildId: serverId,
    inGuild: () => true,
    user: { id: userId },
    update,
  } as unknown as ButtonInteraction;
  await character.button!(interaction, context);
  return update.mock.calls[0]![0] as { content: string; components: unknown[] };
}

const buttonIds = (reply: Awaited<ReturnType<typeof ask>>) =>
  reply.components![0]!.toJSON().components.map((button) => button.custom_id);

describe('/character remove', () => {
  it('asks to confirm, then removes the character and names the new main', async () => {
    const reply = await ask('thrall');

    expect(reply.content).toContain('Remove **Thrall**, your main, from the roster?');
    const [remove, cancel] = buttonIds(reply);
    expect(cancel).toBe('character:cancel');

    const done = await click(remove!);

    expect(done).toEqual({
      content: '**Thrall** was removed from the roster. **Zuljin** is now your main.',
      components: [],
    });
    expect((await Character.findOne({ where: { name: 'Thrall' } }))!.removedAt).not.toBeNull();
  });

  it('removes nothing when cancelled', async () => {
    const done = await click('character:cancel');

    expect(done.content).toBe('Nothing was removed.');
    expect(await Character.count({ where: { removedAt: null } })).toBe(2);
  });

  it("refuses a character that isn't theirs", async () => {
    const reply = await ask('Jaina');

    expect(reply.content).toBe("You don't have a character called **Jaina** on the roster.");
    expect(reply.components).toBeUndefined();
  });

  it("doesn't let someone else confirm", async () => {
    const [remove] = buttonIds(await ask('Zuljin'));

    const done = await click(remove!, '200000000000000009');

    expect(done.content).toBe("You aren't on the roster of Horde. Use /register to ask to join.");
    expect(await Character.count({ where: { removedAt: null } })).toBe(2);
  });
});
