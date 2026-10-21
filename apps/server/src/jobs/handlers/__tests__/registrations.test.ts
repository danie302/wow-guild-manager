import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeCharacterLookup } from '../../../../test/fake-character-lookup.js';
import { FakeDirectMessenger } from '../../../../test/fake-direct-messenger.js';
import { createTestGuild } from '../../../../test/test-guild.js';
import { type Guild, User } from '../../../db/models/index.js';
import { createSequelize } from '../../../db/sequelize.js';
import {
  approveRegistration,
  registerCharacter,
  rejectRegistration,
} from '../../../domain/registrations.js';
import { createTestLogger } from '../../../test-logger.js';
import { registrationHandlers } from '../registrations.js';

const serverId = '300000000000000001';
const thrall = { discordUserId: '200000000000000002', discordName: 'Thrall', discordAvatar: null };

let sequelize: Sequelize;
let gm: User;
let guild: Guild;
let lookup: FakeCharacterLookup;
let messenger: FakeDirectMessenger;
let handlers: ReturnType<typeof registrationHandlers>;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
  gm = await User.create({ discordId: '200000000000000001', name: 'Garrosh', avatar: null });
  guild = await createTestGuild(gm, { serverId, name: 'Orgrimmar Guard' });
  lookup = new FakeCharacterLookup();
  messenger = new FakeDirectMessenger();
  handlers = registrationHandlers({
    logger: createTestLogger().logger,
    characterLookup: lookup,
    messenger,
  });
});

async function register(locale: 'en' | 'es' | null = 'en') {
  const outcome = await registerCharacter(serverId, thrall, 'Jaina', locale);
  if (outcome.result !== 'created') throw new Error(outcome.result);
  return outcome.registration;
}

describe('registration-lookup', () => {
  it('sends no message while the registration waits for an Officer', async () => {
    const registration = await register();

    await handlers['registration-lookup']({ registrationId: registration.id });

    await registration.reload();
    expect(registration.lookup).toBe('not_found');
    expect(messenger.sent).toEqual([]);
  });

  it('tells the member, in their language, that a character of the wrong faction was rejected', async () => {
    lookup.addCharacter({
      name: 'Jaina',
      faction: 'alliance',
      race: 'human',
      characterClass: 'mage',
      level: 60,
    });
    const registration = await register('es');

    await handlers['registration-lookup']({ registrationId: registration.id });

    expect(messenger.sent).toEqual([
      {
        userId: thrall.discordUserId,
        content:
          'Tu registro de **Jaina** en Orgrimmar Guard fue rechazado: Jaina es Alliance y Orgrimmar Guard es una hermandad Horde.',
      },
    ]);
  });
});

describe('registration-reviewed', () => {
  it('tells the member their character was approved', async () => {
    const registration = await register();
    await approveRegistration(
      guild,
      registration.id,
      { race: 'orc', class: 'warrior', level: 10 },
      gm,
    );

    await handlers['registration-reviewed']({ registrationId: registration.id });

    expect(messenger.sent).toEqual([
      {
        userId: thrall.discordUserId,
        content:
          'Your character **Jaina** was approved and added to the roster of Orgrimmar Guard.',
      },
    ]);
  });

  it('tells the member an Officer rejected it', async () => {
    const registration = await register();
    await rejectRegistration(guild, registration.id, gm);

    await handlers['registration-reviewed']({ registrationId: registration.id });

    expect(messenger.sent.map((message) => message.content)).toEqual([
      'An Officer of Orgrimmar Guard rejected your registration of **Jaina**.',
    ]);
  });

  it('sends nothing for a registration that is still pending or gone', async () => {
    const registration = await register();

    await handlers['registration-reviewed']({ registrationId: registration.id });
    await handlers['registration-reviewed']({
      registrationId: '01900000-0000-7000-8000-000000000000',
    });

    expect(messenger.sent).toEqual([]);
  });

  it("doesn't fail when the member doesn't accept direct messages", async () => {
    messenger.blocked.add(thrall.discordUserId);
    const registration = await register();
    await rejectRegistration(guild, registration.id, gm);

    await expect(
      handlers['registration-reviewed']({ registrationId: registration.id }),
    ).resolves.toBeUndefined();
  });
});
