import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeJobQueue } from '../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../test/test-guild.js';
import { Character, Member, SignUp, User, type Event, type Guild } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { scheduleTentativeJobs } from '../../jobs/tentative.js';
import { cancelEvent, createEvent, updateEvent } from '../events.js';
import { signUp } from '../sign-ups.js';
import { applyGuildDeadline, replaceAtDeadline, takeReminders } from '../tentative.js';

const serverId = '300000000000000001';
const hour = 60 * 60 * 1000;
const now = new Date();

let sequelize: Sequelize;
let gm: User;
let guild: Guild;
let discordIds = 200000000000000100n;

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
});

const details = { name: 'Warsong Gulch', description: '', size: 2 };
const slots = { tank: 1, healer: 0, dps: 1 };

/** A PvP event starting in `hoursAway`, with its own deadline if given. */
function event(hoursAway: number, tentativeDeadlineHours: number | null = null) {
  return createEvent(
    guild,
    {
      type: 'pvp',
      ...details,
      slots,
      startsAt: new Date(now.getTime() + hoursAway * hour).toISOString(),
      tentativeDeadlineHours,
    },
    gm,
    now,
  );
}

async function join(target: Event, status: 'confirmed' | 'tentative', at: Date) {
  const discordUserId = String(discordIds++);
  const member = await Member.create({
    guildId: guild.id,
    discordUserId,
    discordName: 'Player',
    discordAvatar: null,
    rank: 'raider',
  });
  const character = await Character.create({
    memberId: member.id,
    name: `Char${discordUserId.slice(-3)}`,
    faction: 'horde',
    race: 'orc',
    characterClass: 'warrior',
    level: 60,
    professions: [],
    isMain: true,
  });
  const outcome = await signUp(
    serverId,
    discordUserId,
    target.id,
    { characterId: character.id, role: 'tank', status },
    at,
  );
  if (outcome.result !== 'signed_up') throw new Error(outcome.result);
  return (await SignUp.findOne({ where: { memberId: member.id } }))!;
}

const hoursBefore = (target: Event) =>
  (target.startsAt.getTime() - target.tentativeDeadlineAt.getTime()) / hour;

describe('the deadline', () => {
  it("is the guild's, or the event's own, and follows the event's time", async () => {
    const guildDeadline = await event(100);
    const own = await event(100, 48);

    expect([hoursBefore(guildDeadline), hoursBefore(own)]).toEqual([24, 48]);

    const { event: moved } = await updateEvent(
      guild,
      own.id,
      { ...details, slots, startsAt: new Date(now.getTime() + 120 * hour).toISOString() },
      now,
    );
    // Left out, the own deadline is cleared: back to the guild's.
    expect(hoursBefore(moved)).toBe(24);
  });

  it('moves with the guild setting, unless the new deadline has passed or the event has its own', async () => {
    const far = await event(100);
    const near = await event(30);
    const own = await event(100, 6);
    await guild.update({ tentativeDeadlineHours: 48 });

    const movedIds = await applyGuildDeadline(guild, now);

    expect(movedIds).toEqual([far.id]);
    expect(hoursBefore(await far.reload())).toBe(48);
    expect(hoursBefore(await near.reload())).toBe(24);
    expect(hoursBefore(await own.reload())).toBe(6);
  });

  it('only takes Confirmed sign-ups once it has passed', async () => {
    const soon = await event(10);

    await expect(join(soon, 'tentative', now)).rejects.toThrow('tentative_closed');
    await expect(join(soon, 'confirmed', now)).resolves.toBeDefined();
  });
});

describe('the reminder', () => {
  it('goes once to each Tentative participant, between the reminder time and the deadline', async () => {
    const target = await event(100);
    const tentative = await join(target, 'tentative', now);
    await join(target, 'confirmed', now);
    const reminderTime = new Date(target.tentativeDeadlineAt.getTime() - 12 * hour);

    const early = await takeReminders(target.id, new Date(reminderTime.getTime() - hour));
    const onTime = await takeReminders(target.id, reminderTime);
    const again = await takeReminders(target.id, new Date(reminderTime.getTime() + hour));

    expect(early).toEqual([]);
    expect(onTime.map((s) => s.id)).toEqual([tentative.id]);
    expect(again).toEqual([]);
  });
});

describe('the deadline replacement', () => {
  it('replaces the most recent Tentative participants first, with the earliest waitlisted', async () => {
    const target = await event(100);
    await updateEvent(
      guild,
      target.id,
      {
        ...details,
        size: 3,
        slots: { tank: 2, healer: 0, dps: 1 },
        startsAt: target.startsAt.toISOString(),
      },
      now,
    );
    const first = await join(target, 'tentative', now);
    const second = await join(target, 'tentative', new Date(now.getTime() + 1000));
    const waiting = await join(target, 'confirmed', new Date(now.getTime() + 2000));
    await target.reload();

    const changes = await replaceAtDeadline(target.id, target.tentativeDeadlineAt);

    expect(changes).toMatchObject({ promoted: [waiting.id], replaced: [second.id] });
    expect((await first.reload()).placement).toBe('slot');
    expect((await second.reload()).placement).toBe('waitlist');
  });

  it('keeps a Tentative participant when nobody is waiting, and does nothing before the deadline', async () => {
    const target = await event(100);
    const tentative = await join(target, 'tentative', now);

    const early = await replaceAtDeadline(target.id, now);
    const atDeadline = await replaceAtDeadline(target.id, target.tentativeDeadlineAt);

    expect(early.replaced).toEqual([]);
    expect(atDeadline.replaced).toEqual([]);
    expect((await tentative.reload()).placement).toBe('slot');
  });

  it('does nothing for a cancelled event', async () => {
    const target = await event(100);
    await join(target, 'tentative', now);
    await join(target, 'tentative', now);
    await cancelEvent(guild, target.id, gm, now);

    expect((await replaceAtDeadline(target.id, target.tentativeDeadlineAt)).replaced).toEqual([]);
  });
});

describe('scheduleTentativeJobs', () => {
  it('schedules one reminder and one deadline per event, and moves them on a change', async () => {
    const target = await event(100);
    const jobs = new FakeJobQueue();

    await scheduleTentativeJobs(jobs, [target.id], now);
    await scheduleTentativeJobs(jobs, [target.id], now);

    expect(jobs.jobs.map(({ name, jobId, runAt }) => [name, jobId, runAt])).toEqual([
      [
        'tentative-reminder',
        `tentative-reminder-${target.id}`,
        new Date(target.tentativeDeadlineAt.getTime() - 12 * hour),
      ],
      ['tentative-deadline', `tentative-deadline-${target.id}`, target.tentativeDeadlineAt],
    ]);
  });

  it('removes the jobs of a cancelled event', async () => {
    const target = await event(100);
    const jobs = new FakeJobQueue();
    await scheduleTentativeJobs(jobs, [target.id], now);

    await cancelEvent(guild, target.id, gm, now);
    await scheduleTentativeJobs(jobs, [target.id], now);

    expect(jobs.jobs).toEqual([]);
  });
});
