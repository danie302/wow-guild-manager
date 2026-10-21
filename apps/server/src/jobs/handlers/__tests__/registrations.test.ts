import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeDirectMessenger } from '../../../../test/fake-direct-messenger.js';
import { createTestGuild } from '../../../../test/test-guild.js';
import { User, type Guild } from '../../../db/models/index.js';
import { createSequelize } from '../../../db/sequelize.js';
import {
  approveRegistration,
  rejectRegistration,
  requestToJoin,
} from '../../../domain/registrations.js';
import { createTestLogger } from '../../../test-logger.js';
import { registrationHandlers } from '../registrations.js';

const serverId = '300000000000000001';
const thrall = { discordUserId: '200000000000000002', discordName: 'Thrall', discordAvatar: null };

let sequelize: Sequelize;
let gm: User;
let guild: Guild;
let messenger: FakeDirectMessenger;
let reviewed: ReturnType<typeof registrationHandlers>['registration-reviewed'];

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
  messenger = new FakeDirectMessenger();
  reviewed = registrationHandlers({ logger: createTestLogger().logger, messenger })[
    'registration-reviewed'
  ];
});

async function request(locale: 'en' | 'es' = 'en') {
  const outcome = await requestToJoin(serverId, thrall, locale);
  if (outcome.result !== 'created') throw new Error(outcome.result);
  return outcome.registration;
}

describe('registration-reviewed', () => {
  it('tells them their request was approved', async () => {
    const registration = await request();
    await approveRegistration(guild, registration.id, gm);

    await reviewed({ registrationId: registration.id });

    expect(messenger.sent).toEqual([
      {
        userId: thrall.discordUserId,
        content: "Your request to join Orgrimmar Guard was approved. You're on the roster now.",
      },
    ]);
  });

  it('tells them, in the language they used, that an Officer rejected it', async () => {
    const registration = await request('es');
    await rejectRegistration(guild, registration.id, gm);

    await reviewed({ registrationId: registration.id });

    expect(messenger.sent.map((message) => message.content)).toEqual([
      'Un Officer de Orgrimmar Guard rechazó tu solicitud para entrar.',
    ]);
  });

  it('sends nothing for a request that is still pending or gone', async () => {
    const registration = await request();

    await reviewed({ registrationId: registration.id });
    await reviewed({ registrationId: '01900000-0000-7000-8000-000000000000' });

    expect(messenger.sent).toEqual([]);
  });

  it("doesn't fail when they don't accept direct messages", async () => {
    messenger.blocked.add(thrall.discordUserId);
    const registration = await request();
    await rejectRegistration(guild, registration.id, gm);

    await expect(reviewed({ registrationId: registration.id })).resolves.toBeUndefined();
  });
});
