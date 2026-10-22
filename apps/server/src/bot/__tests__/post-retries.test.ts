import { EventEmitter } from 'node:events';

import { Events, type Client } from 'discord.js';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeJobQueue } from '../../../test/fake-job-queue.js';
import { createTestGuild } from '../../../test/test-guild.js';
import { Event, User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { createTestLogger } from '../../test-logger.js';
import { retryFailedPosts } from '../post-retries.js';

const serverId = '300000000000000001';
const botId = '100000000000000099';
const day = 24 * 60 * 60 * 1000;

let sequelize: Sequelize;
let failed: Event;

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
  const columns = {
    guildId: guild.id,
    type: 'raid' as const,
    name: 'Molten Core',
    description: '',
    size: 40,
    tankSlots: 4,
    healerSlots: 10,
    dpsSlots: 26,
    createdByUserId: null,
    // Not about the deadline; any time does.
    tentativeDeadlineAt: new Date(),
  };
  const later = (days: number) => new Date(Date.now() + days * day);
  failed = await Event.create({
    ...columns,
    startsAt: later(3),
    discordPostError: 'missing_permissions',
  });
  // Fine, past, or cancelled: none of these is retried.
  await Event.create({ ...columns, startsAt: later(4) });
  await Event.create({
    ...columns,
    startsAt: later(-1),
    discordPostError: 'missing_permissions',
  });
  await Event.create({
    ...columns,
    startsAt: later(5),
    cancelledAt: new Date(),
    discordPostError: 'missing_permissions',
  });
});

function setup() {
  const client = Object.assign(new EventEmitter(), {
    user: { id: botId },
    guilds: { cache: new Map([[serverId, {}]]) },
  });
  const jobs = new FakeJobQueue();
  retryFailedPosts(client as unknown as Client, jobs, createTestLogger().logger);
  return { client, jobs };
}

const server = { id: serverId };
const channel = { guild: server, isDMBased: () => false };

describe('retryFailedPosts', () => {
  it.each([
    ["a channel's permissions change", Events.ChannelUpdate, [{}, channel]],
    ['a role changes', Events.GuildRoleUpdate, [{}, { guild: server }]],
    ['the bot gets a new role', Events.GuildMemberUpdate, [{}, { id: botId, guild: server }]],
    ['the bot connects', Events.ShardReady, [0]],
  ])('retries the failed posts of upcoming events when %s', async (_case, event, args) => {
    const { client, jobs } = setup();

    client.emit(event, ...args);

    await vi.waitFor(() => expect(jobs.payloads('event-post')).toEqual([{ eventId: failed.id }]));
  });

  it("ignores another member's role changes", async () => {
    const { client, jobs } = setup();

    client.emit(Events.GuildMemberUpdate, {}, { id: '200000000000000001', guild: server });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(jobs.jobs).toEqual([]);
  });

  it('ignores other servers', async () => {
    const { client, jobs } = setup();

    client.emit(Events.GuildRoleUpdate, {}, { guild: { id: '300000000000000002' } });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(jobs.jobs).toEqual([]);
  });
});
