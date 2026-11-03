import type { CharacterClass } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeChannelMessages } from '../../../test/fake-channel-messages.js';
import { FakeJobQueue } from '../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../test/test-guild.js';
import { Character, Member, SignUp, User, type Event, type Guild } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { removeOldMissingRoleChecks, scheduleEventJobs } from '../../jobs/event-jobs.js';
import { missingRoleHandlers } from '../../jobs/handlers/missing-roles.js';
import { createTestLogger } from '../../test-logger.js';
import { cancelEvent, createEvent } from '../events.js';
import { missingRoleAlert, missingRoles } from '../missing-roles.js';

const serverId = '300000000000000001';
const channelId = '500000000000000001';
const memberRoleId = '400000000000000001';
const hour = 60 * 60 * 1000;

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
  await guild.update({ eventsChannelId: channelId });
});

/** A roster member with one character of the class; returns their Discord ID. */
async function member(
  characterClass: CharacterClass,
  {
    rank = 'raider',
    leftDiscord = false,
  }: { rank?: 'raider' | 'member'; leftDiscord?: boolean } = {},
) {
  const discordUserId = String(discordIds++);
  const created = await Member.create({
    guildId: guild.id,
    discordUserId,
    discordName: `Player ${discordUserId.slice(-3)}`,
    discordAvatar: null,
    rank,
    leftDiscordAt: leftDiscord ? new Date() : null,
  });
  const character = await Character.create({
    memberId: created.id,
    name: `Char${discordUserId.slice(-3)}`,
    faction: 'horde',
    race: 'orc',
    characterClass,
    level: 60,
    professions: [],
    isMain: true,
  });
  return { discordUserId, member: created, character };
}

function raid(hoursAway = 47, missingRoleAlertHours?: number) {
  return createEvent(
    guild,
    {
      type: 'raid',
      name: 'Blackwing Lair',
      description: '',
      startsAt: new Date(Date.now() + hoursAway * hour).toISOString(),
      size: 10,
      slots: { tank: 1, healer: 2, dps: 7 },
      ...(missingRoleAlertHours && { missingRoleAlertHours }),
    },
    gm,
  );
}

async function signUp(
  who: Awaited<ReturnType<typeof member>>,
  event: Event,
  role: 'tank' | 'healer' | 'dps' | null,
  status: 'confirmed' | 'declined' = 'confirmed',
) {
  await SignUp.create({
    eventId: event.id,
    memberId: who.member.id,
    characterId: who.character.id,
    role,
    status,
    placement: status === 'declined' ? null : 'slot',
    signedUpAt: new Date(),
  });
}

describe('missingRoles', () => {
  it('lists the roles with open slots and how many are missing', async () => {
    const event = await raid();
    const tank = await member('warrior');
    const declined = await member('priest');
    await signUp(tank, event, 'tank');
    await signUp(declined, event, null, 'declined');

    expect(await missingRoles(event)).toEqual([
      { role: 'healer', missing: 2 },
      { role: 'dps', missing: 7 },
    ]);
  });
});

describe('missingRoleAlert', () => {
  it('has a line per role, in the guild language, and mentions the Guild Member role', async () => {
    const event = await raid();
    const roles = [
      { role: 'healer', missing: 2 },
      { role: 'tank', missing: 1 },
    ] as const;

    const en = missingRoleAlert(event, 'en', [...roles], memberRoleId);
    const es = missingRoleAlert(event, 'es', [{ role: 'tank', missing: 1 }], memberRoleId);

    const unix = Math.floor(event.startsAt.getTime() / 1000);
    expect(en).toEqual({
      content: `⚠️ **Blackwing Lair** – <t:${unix}:F>\n2 Healers still needed\n1 Tank still needed\n<@&${memberRoleId}>`,
      mentionRoleIds: [memberRoleId],
    });
    expect(es.content).toContain(`Falta 1 Tank\n<@&${memberRoleId}>`);
  });

  it('mentions nobody without a Guild Member role', async () => {
    const event = await raid();

    const alert = missingRoleAlert(event, 'en', [{ role: 'dps', missing: 7 }], null);

    expect(alert.mentionRoleIds).toEqual([]);
    expect(alert.content).not.toContain('<@');
  });
});

describe('the missing-role checks', () => {
  it('are one per event at its alert time (24 hours by default), skipping those already past', async () => {
    const usual = await raid(100);
    const own = await raid(100, 60);
    const near = await raid(20);
    const jobs = new FakeJobQueue();

    await scheduleEventJobs(jobs, [usual.id, own.id, near.id]);

    expect(jobs.job(`missing-roles-${usual.id}`)?.runAt).toEqual(
      new Date(usual.startsAt.getTime() - 24 * hour),
    );
    expect(jobs.job(`missing-roles-${usual.id}`)?.data).toEqual({ eventId: usual.id });
    expect(jobs.job(`missing-roles-${own.id}`)?.runAt).toEqual(
      new Date(own.startsAt.getTime() - 60 * hour),
    );
    expect(jobs.job(`missing-roles-${near.id}`)).toBeUndefined();
  });

  it('move when the alert time changes, and go away when it has passed', async () => {
    const event = await raid(100);
    const jobs = new FakeJobQueue();
    await scheduleEventJobs(jobs, [event.id]);

    await event.update({ missingRoleAlertHours: 72 });
    await scheduleEventJobs(jobs, [event.id]);
    expect(jobs.job(`missing-roles-${event.id}`)?.runAt).toEqual(
      new Date(event.startsAt.getTime() - 72 * hour),
    );

    await event.update({ startsAt: new Date(Date.now() + 10 * hour) });
    await scheduleEventJobs(jobs, [event.id]);
    expect(jobs.job(`missing-roles-${event.id}`)).toBeUndefined();
  });

  it('from before there was one per event are removed', async () => {
    const event = await raid(100);
    const jobs = new FakeJobQueue();
    for (const hours of [48, 24]) {
      await jobs.schedule(
        'missing-role-check',
        { eventId: event.id },
        { jobId: `missing-roles-${hours}-${event.id}`, runAt: new Date(Date.now() + hour) },
      );
    }

    await removeOldMissingRoleChecks(jobs, [event.id]);

    expect(jobs.job(`missing-roles-48-${event.id}`)).toBeUndefined();
    expect(jobs.job(`missing-roles-24-${event.id}`)).toBeUndefined();
  });

  it('post one alert as a reply to the event post, and nothing when the event is full or gone', async () => {
    const event = await raid(23.5);
    await event.update({ discordChannelId: channelId, discordMessageId: '600000000000000001' });
    await guild.update({ memberRoleId });
    const discord = new FakeChannelMessages();
    const check = missingRoleHandlers({
      logger: createTestLogger().logger,
      channelMessages: discord,
    })['missing-role-check'];

    await check({ eventId: event.id });
    // A check queued before there was one per event says nothing.
    await check({ eventId: event.id, hoursBefore: 48 } as { eventId: string });

    const [alert] = [...discord.messages(channelId).values()];
    expect(discord.messages(channelId).size).toBe(1);
    expect(alert).toMatchObject({
      replyTo: '600000000000000001',
      mentionRoleIds: [memberRoleId],
    });
    expect(alert!.content).toContain(`2 Healers still needed\n`);
    expect(alert!.content).toMatch(new RegExp(`<@&${memberRoleId}>$`));

    await cancelEvent(guild, event.id, gm);
    await check({ eventId: event.id });
    expect(discord.messages(channelId).size).toBe(1);
  });

  it("post in the channel of the event's post, e.g. its type's channel", async () => {
    const raidChannel = '500000000000000009';
    await guild.update({ raidChannelId: raidChannel });
    const event = await raid(23.5);
    await event.update({ discordChannelId: raidChannel, discordMessageId: '600000000000000002' });
    await member('priest');
    const discord = new FakeChannelMessages();

    await missingRoleHandlers({
      logger: createTestLogger().logger,
      channelMessages: discord,
    })['missing-role-check']({ eventId: event.id });

    expect(discord.messages(channelId).size).toBe(0);
    expect([...discord.messages(raidChannel).values()]).toMatchObject([
      { replyTo: '600000000000000002' },
    ]);
  });

  it('wait when the event moved later or its alert time is closer to the start', async () => {
    const moved = await raid(40);
    const closer = await raid(23.5, 12);
    const discord = new FakeChannelMessages();
    const check = missingRoleHandlers({
      logger: createTestLogger().logger,
      channelMessages: discord,
    })['missing-role-check'];

    await check({ eventId: moved.id });
    await check({ eventId: closer.id });

    expect(discord.channels.size).toBe(0);
  });
});
