import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeDirectMessenger } from '../../../../test/fake-direct-messenger.js';
import { FakeJobQueue } from '../../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../../test/test-guild.js';
import {
  Character,
  Member,
  SignUp,
  User,
  type Event,
  type Guild,
} from '../../../db/models/index.js';
import { createSequelize } from '../../../db/sequelize.js';
import { cancelEvent, createEvent } from '../../../domain/events.js';
import { createTestLogger } from '../../../test-logger.js';
import { notifySignUpChanges } from '../../sign-up-notices.js';
import { signUpNoticeHandlers } from '../sign-up-notices.js';
import { tentativeHandlers } from '../tentative.js';

const serverId = '300000000000000001';
const playerId = '200000000000000002';
const startsAt = new Date('2030-03-05T20:00:00Z');
const unix = startsAt.getTime() / 1000;

let sequelize: Sequelize;
let gm: User;
let guild: Guild;
let member: Member;
let event: Event;
let messenger: FakeDirectMessenger;
let handlers: ReturnType<typeof signUpNoticeHandlers>;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
  gm = await User.create({ discordId: '200000000000000001', name: 'Garrosh', avatar: null });
  guild = await createTestGuild(gm, { serverId });
  event = await createEvent(
    guild,
    {
      type: 'pvp',
      name: 'Warsong Gulch',
      description: '',
      startsAt: startsAt.toISOString(),
      size: 10,
      slots: { tank: 1, healer: 2, dps: 7 },
    },
    gm,
  );
  member = await Member.create({
    guildId: guild.id,
    discordUserId: playerId,
    discordName: 'Thrall',
    discordAvatar: null,
    rank: 'raider',
  });
  messenger = new FakeDirectMessenger();
  handlers = signUpNoticeHandlers({ logger: createTestLogger().logger, messenger });
});

async function signUpWith(placement: 'slot' | 'waitlist', target = event) {
  const character = await Character.create({
    memberId: member.id,
    name: 'Thrall',
    faction: 'horde',
    race: 'orc',
    characterClass: 'shaman',
    level: 60,
    professions: [],
    isMain: true,
  });
  return SignUp.create({
    eventId: target.id,
    memberId: member.id,
    characterId: character.id,
    role: 'healer',
    status: 'confirmed',
    placement,
    signedUpAt: new Date(),
  });
}

describe('sign-up notices', () => {
  it('tells a promoted member their character got a slot', async () => {
    const signUp = await signUpWith('slot');

    await handlers['waitlist-promoted']({ signUpId: signUp.id });

    expect(messenger.sent).toEqual([
      {
        userId: playerId,
        content: `A spot opened in **Warsong Gulch** (<t:${unix}:F>): Thrall is in as Healer. If you can no longer make it, press Declined on the event.`,
      },
    ]);
  });

  it('tells a member their character moved to the waitlist, in their language', async () => {
    await member.update({ locale: 'es' });
    const signUp = await signUpWith('waitlist');

    await handlers['moved-to-waitlist']({ signUpId: signUp.id });

    expect(messenger.sent[0]?.content).toMatch(
      /^\*\*Warsong Gulch\*\* .* ahora tiene menos plazas de Healer/,
    );
  });

  it('says nothing when the sign-up moved again or the event was cancelled', async () => {
    const signUp = await signUpWith('waitlist');

    await handlers['waitlist-promoted']({ signUpId: signUp.id });
    await signUp.update({ placement: 'slot' });
    await cancelEvent(guild, event.id, gm);
    await handlers['waitlist-promoted']({ signUpId: signUp.id });

    expect(messenger.sent).toEqual([]);
  });

  it('lists all of a member’s rescheduled events in one message', async () => {
    await signUpWith('slot');

    await handlers['events-rescheduled']({ memberId: member.id, eventIds: [event.id] });

    expect(messenger.sent).toEqual([
      {
        userId: playerId,
        content: `The time of an event you signed up for changed:\n• **Warsong Gulch**: <t:${unix}:F>`,
      },
    ]);
  });
});

describe('tentative-reminder', () => {
  it('reminds a Tentative participant once, with the deadline', async () => {
    const signUp = await signUpWith('slot');
    await signUp.update({ status: 'tentative' });
    // The reminder time has come: the deadline is in 6 hours, under the guild's 12.
    const deadline = new Date(Date.now() + 6 * 60 * 60 * 1000);
    await event.update({ tentativeDeadlineAt: deadline });
    const handlers = tentativeHandlers({
      logger: createTestLogger().logger,
      messenger,
      jobs: new FakeJobQueue(),
    });

    await handlers['tentative-reminder']({ eventId: event.id });
    await handlers['tentative-reminder']({ eventId: event.id });

    expect(messenger.sent).toHaveLength(1);
    expect(messenger.sent[0]?.content).toContain(
      `Confirm before <t:${Math.floor(deadline.getTime() / 1000)}:F>`,
    );
  });
});

describe('notifySignUpChanges', () => {
  it('sends one rescheduling message per member, and updates the posts', async () => {
    const jobs = new FakeJobQueue();

    await notifySignUpChanges(jobs, {
      promoted: ['a'],
      movedToWaitlist: ['b'],
      rescheduled: [
        { memberId: 'm1', eventId: 'e1' },
        { memberId: 'm1', eventId: 'e2' },
        { memberId: 'm2', eventId: 'e1' },
      ],
      replaced: [],
      removed: [],
      eventIds: ['e3'],
    });

    expect(jobs.jobs.map(({ name, data }) => [name, data])).toEqual([
      ['waitlist-promoted', { signUpId: 'a' }],
      ['moved-to-waitlist', { signUpId: 'b' }],
      ['events-rescheduled', { memberId: 'm1', eventIds: ['e1', 'e2'] }],
      ['events-rescheduled', { memberId: 'm2', eventIds: ['e1'] }],
      ['event-post', { eventId: 'e3' }],
    ]);
  });
});
