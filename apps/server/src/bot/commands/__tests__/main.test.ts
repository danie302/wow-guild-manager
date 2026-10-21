import type { CharacterInput } from '@wgm/shared';
import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestGuild } from '../../../../test/test-guild.js';
import { User } from '../../../db/models/index.js';
import { createSequelize } from '../../../db/sequelize.js';
import { addMember } from '../../../domain/roster.js';
import { translator } from '../../../i18n/index.js';
import { main } from '../main.js';

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
    { ...shaman, name: 'Zalazane', race: 'troll', class: 'priest' },
  ]);
});

function interaction(extra: object) {
  return {
    guildId: serverId,
    inGuild: () => true,
    user: { id: thrall.discordUserId },
    ...extra,
  };
}

describe('/main', () => {
  it('makes the chosen character the main', async () => {
    const reply = vi.fn<(options: unknown) => Promise<void>>(() => Promise.resolve());
    const command = interaction({
      options: { getString: () => 'zuljin' },
      reply,
    }) as unknown as ChatInputCommandInteraction;

    await main.execute(command, { locale: 'en', t: translator('en') });

    expect(reply.mock.calls[0]![0]).toMatchObject({ content: '**Zuljin** is now your main.' });
  });

  it("explains that a character that isn't theirs must be added by an Officer", async () => {
    const reply = vi.fn<(options: unknown) => Promise<void>>(() => Promise.resolve());
    const command = interaction({
      options: { getString: () => 'Jaina' },
      reply,
    }) as unknown as ChatInputCommandInteraction;

    await main.execute(command, { locale: 'es', t: translator('es') });

    expect(reply.mock.calls[0]![0]).toMatchObject({
      content:
        'No tienes un personaje llamado **Jaina** en la plantilla. Un Officer puede añadirlo en la aplicación web.',
    });
  });

  it('suggests their characters that start with what they typed', async () => {
    const respond = vi.fn<(choices: unknown) => Promise<void>>(() => Promise.resolve());
    const typing = interaction({
      options: { getFocused: () => 'Z' },
      respond,
    }) as unknown as AutocompleteInteraction;

    await main.autocomplete!(typing);

    expect(respond).toHaveBeenCalledWith([
      { name: 'Zalazane', value: 'Zalazane' },
      { name: 'Zuljin', value: 'Zuljin' },
    ]);
  });
});
