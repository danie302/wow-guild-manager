import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeJobQueue } from '../../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../../test/test-guild.js';
import { CharacterRegistration, User } from '../../../db/models/index.js';
import { createSequelize } from '../../../db/sequelize.js';
import { translator } from '../../../i18n/index.js';
import { registerCommand } from '../register.js';

const serverId = '300000000000000001';

let sequelize: Sequelize;
let jobs: FakeJobQueue;

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
  jobs = new FakeJobQueue();
});

/** Runs /register as Thrall with `name`, and returns the reply. */
async function run(
  name: string,
  { guildId = serverId, locale = 'en' }: { guildId?: string; locale?: 'en' | 'es' } = {},
) {
  const reply = vi.fn<(options: unknown) => Promise<void>>(() => Promise.resolve());
  const interaction = {
    guildId,
    locale,
    inGuild: () => true,
    inCachedGuild: () => false,
    user: { id: '200000000000000002', displayName: 'Thrall', avatar: null },
    options: { getString: () => name },
    reply,
  } as unknown as ChatInputCommandInteraction;
  await registerCommand(jobs).execute(interaction, { locale, t: translator(locale) });
  return reply.mock.calls[0]?.[0];
}

describe('/register', () => {
  it('registers the character, queues its lookup, and answers only to the member', async () => {
    const reply = await run('  Thrall ');

    const registration = await CharacterRegistration.findOne();
    expect(registration).toMatchObject({ name: 'Thrall', discordName: 'Thrall', locale: 'en' });
    expect(jobs.payloads('registration-lookup')).toEqual([{ registrationId: registration!.id }]);
    expect(reply).toEqual({
      content:
        "**Thrall** is registered. An Officer of Orgrimmar Guard will review it, and I'll send you a direct message when they do.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it('answers in Spanish when the member uses Discord in Spanish', async () => {
    await run('Thrall');

    const reply = await run('thrall', { locale: 'es' });

    expect(reply).toMatchObject({
      content: '**thrall** ya tiene un registro esperando a un Officer.',
    });
    expect(jobs.jobs).toHaveLength(1);
  });

  it('explains when the server has no guild', async () => {
    const reply = await run('Thrall', { guildId: '399999999999999999' });

    expect(reply).toMatchObject({
      content: "This Discord server isn't connected to a guild yet.",
    });
    expect(await CharacterRegistration.count()).toBe(0);
  });

  it('refuses a blank name', async () => {
    const reply = await run('   ');

    expect(reply).toMatchObject({ content: 'Enter a character name of up to 64 characters.' });
  });
});
