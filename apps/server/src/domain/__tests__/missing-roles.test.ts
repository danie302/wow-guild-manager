import type { CharacterClass } from '@wgm/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FakeChannelMessages } from '../../../test/fake-channel-messages.js';
import { FakeJobQueue } from '../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../test/test-guild.js';
import { Character, Member, SignUp, User, type Event, type Guild } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { scheduleEventJobs } from '../../jobs/event-jobs.js';
import { missingRoleHandlers } from '../../jobs/handlers/missing-roles.js';
import { createTestLogger } from '../../test-logger.js';
import { cancelEvent, createEvent } from '../events.js';
import { missingRoleAlert, missingRoles } from '../missing-roles.js';

const serverId = '300000000000000001';
const channelId = '500000000000000001';
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

function raid(hoursAway = 47) {
  return createEvent(
    guild,
    {
      type: 'raid',
      name: 'Blackwing Lair',
      description: '',
      startsAt: new Date(Date.now() + hoursAway * hour).toISOString(),
      size: 10,
      slots: { tank: 1, healer: 2, dps: 7 },
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
  it('lists open roles with who could fill them and has not answered', async () => {
    const event = await raid();
    const tank = await member('warrior');
    const priest = await member('priest');
    const druid = await member('druid');
    const declined = await member('priest');
    await member('priest', { rank: 'member' });
    await member('priest', { leftDiscord: true });
    await signUp(tank, event, 'tank');
    await signUp(declined, event, null, 'declined');

    const roles = await missingRoles(event, guild);

    expect(roles).toEqual([
      { role: 'healer', missing: 2, candidates: [priest.discordUserId, druid.discordUserId] },
      // Priests can play DPS too.
      { role: 'dps', missing: 7, candidates: [priest.discordUserId, druid.discordUserId] },
    ]);
  });
});

describe('missingRoleAlert', () => {
  it('has a line per role, in the guild language, with mentions', async () => {
    const event = await raid();

    const en = missingRoleAlert(event, 'en', [
      { role: 'healer', missing: 2, candidates: ['1', '2'] },
      { role: 'tank', missing: 1, candidates: [] },
    ]);
    const es = missingRoleAlert(event, 'es', [{ role: 'tank', missing: 1, candidates: ['1'] }]);

    const unix = Math.floor(event.startsAt.getTime() / 1000);
    expect(en).toEqual({
      content: `⚠️ **Blackwing Lair** – <t:${unix}:F>\n2 Healers still needed: <@1> <@2>\n1 Tank still needed.`,
      mentions: ['1', '2'],
    });
    expect(es.content).toContain('Falta 1 Tank: <@1>');
  });

  it("cuts the mentions short to fit Discord's limits", async () => {
    const event = await raid();
    const many = Array.from({ length: 300 }, (_, index) =>
      String(200000000000000000n + BigInt(index)),
    );

    const { content, mentions } = missingRoleAlert(event, 'en', [
      { role: 'dps', missing: 7, candidates: many },
    ]);

    expect(content.length).toBeLessThanOrEqual(2000);
    expect(mentions.length).toBeLessThanOrEqual(100);
    expect(content).toMatch(/…and \d+ more$/);
  });
});

describe('the missing-role checks', () => {
  it('are scheduled 48 and 24 hours before, skipping those already past', async () => {
    const far = await raid(100);
    const near = await raid(30);
    const jobs = new FakeJobQueue();

    await scheduleEventJobs(jobs, [far.id, near.id]);

    expect(jobs.job(`missing-roles-48-${far.id}`)?.runAt).toEqual(
      new Date(far.startsAt.getTime() - 48 * hour),
    );
    expect(jobs.job(`missing-roles-24-${far.id}`)).toBeDefined();
    expect(jobs.job(`missing-roles-48-${near.id}`)).toBeUndefined();
    expect(jobs.job(`missing-roles-24-${near.id}`)).toBeDefined();
  });

  it('post one alert as a reply to the event post, and nothing when the event is full or gone', async () => {
    const event = await raid(23.5);
    await event.update({ discordChannelId: channelId, discordMessageId: '600000000000000001' });
    const priest = await member('priest');
    const discord = new FakeChannelMessages();
    const check = missingRoleHandlers({
      logger: createTestLogger().logger,
      channelMessages: discord,
    })['missing-role-check'];

    await check({ eventId: event.id, hoursBefore: 24 });
    // The 48-hour check is late, and the 24-hour one is due: it says nothing.
    await check({ eventId: event.id, hoursBefore: 48 });

    const [alert] = [...discord.messages(channelId).values()];
    expect(discord.messages(channelId).size).toBe(1);
    expect(alert).toMatchObject({
      replyTo: '600000000000000001',
      mentionUserIds: [priest.discordUserId],
    });
    expect(alert!.content).toContain(`2 Healers still needed: <@${priest.discordUserId}>`);

    await cancelEvent(guild, event.id, gm);
    await check({ eventId: event.id, hoursBefore: 24 });
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
    })['missing-role-check']({ eventId: event.id, hoursBefore: 24 });

    expect(discord.messages(channelId).size).toBe(0);
    expect([...discord.messages(raidChannel).values()]).toMatchObject([
      { replyTo: '600000000000000002' },
    ]);
  });

  it('wait when the event moved later', async () => {
    const event = await raid(40);
    const discord = new FakeChannelMessages();

    await missingRoleHandlers({
      logger: createTestLogger().logger,
      channelMessages: discord,
    })['missing-role-check']({ eventId: event.id, hoursBefore: 24 });

    expect(discord.channels.size).toBe(0);
  });
});
