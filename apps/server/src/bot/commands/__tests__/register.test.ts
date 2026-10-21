import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestGuild } from '../../../../test/test-guild.js';
import { Registration, User } from '../../../db/models/index.js';
import { createSequelize } from '../../../db/sequelize.js';
import { translator } from '../../../i18n/index.js';
import { register } from '../register.js';

const serverId = '300000000000000001';

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
  await createTestGuild(gm, { serverId, name: 'Orgrimmar Guard' });
});

/** Runs /register as Thrall, and returns the reply. */
async function run({
  guildId = serverId,
  locale = 'en',
}: { guildId?: string; locale?: 'en' | 'es' } = {}) {
  const reply = vi.fn<(options: unknown) => Promise<void>>(() => Promise.resolve());
  const interaction = {
    guildId,
    locale,
    inGuild: () => true,
    inCachedGuild: () => false,
    user: { id: '200000000000000002', displayName: 'Thrall', avatar: null },
    reply,
  } as unknown as ChatInputCommandInteraction;
  await register.execute(interaction, { locale, t: translator(locale) });
  return reply.mock.calls[0]?.[0];
}

describe('/register', () => {
  it('sends a request to join, and answers only to the member', async () => {
    const reply = await run();

    expect(await Registration.findOne()).toMatchObject({ discordName: 'Thrall', locale: 'en' });
    expect(reply).toEqual({
      content:
        "Your request to join Orgrimmar Guard was sent. An Officer will review it, and I'll send you a direct message when they do.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it('answers in Spanish when the member uses Discord in Spanish', async () => {
    await run();

    const reply = await run({ locale: 'es' });

    expect(reply).toMatchObject({
      content: 'Ya solicitaste entrar en Orgrimmar Guard. Un Officer la revisará pronto.',
    });
    expect(await Registration.count()).toBe(1);
  });

  it('explains when the server has no guild', async () => {
    const reply = await run({ guildId: '399999999999999999' });

    expect(reply).toMatchObject({ content: "This Discord server isn't connected to a guild yet." });
  });
});
