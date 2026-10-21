import type { Sequelize } from 'sequelize';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loginAs, testApp } from '../../../test/api-app.js';
import {
  BOT_USER_ID,
  channel,
  FakeDiscordDirectory,
  MANAGE_GUILD,
  role,
  SEND_MESSAGES,
  server,
} from '../../../test/fake-discord-directory.js';
import { FakeJobQueue } from '../../../test/fake-job-queue.js';
import { Event, Guild, User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { memoryFileStorage } from '../../storage/file-storage.js';

const gm = '200000000000000001';
const officer = '200000000000000002';
const ashen = '300000000000000001';
const officers = '400000000000000001';
const managers = '400000000000000002';
const raidsChannel = '500000000000000001';
const readOnlyChannel = '500000000000000002';

interface Body {
  id: string;
  name: string;
  imageUrl: string | null;
  officerRole: { id: string };
  eventsChannel: { id: string; name: string | null } | null;
  discordLocale: string;
  guilds: { imageUrl: string | null }[];
  error: { code: string; issues: unknown };
}
const body = (response: request.Response) => response.body as Body;

/** A guild led by `gm`, with `officer` holding its Officer role. */
async function setup() {
  const directory = new FakeDiscordDirectory()
    .addServer(
      server(ashen, 'Ashen Vanguard', {
        roles: [
          role(officers, 'Officers'),
          role(managers, 'Managers', { permissions: MANAGE_GUILD }),
        ],
      }),
    )
    .addMember(ashen, gm, [managers])
    .addMember(ashen, officer, [officers])
    .addChannels(ashen, [
      channel(raidsChannel, 'raid-signups'),
      channel(readOnlyChannel, 'rules', {
        overwrites: [{ id: ashen, type: 'role', allow: 0n, deny: SEND_MESSAGES }],
      }),
    ]);
  const storage = memoryFileStorage();
  const jobs = new FakeJobQueue();
  const app = testApp(
    { directory, botInviteUrl: 'https://discord.test/invite', botUserId: BOT_USER_ID },
    storage,
    jobs,
  );
  const gmAgent = await loginAs(app, gm);
  const created = await gmAgent.post('/api/guilds').send({
    name: 'Ashen Vanguard',
    faction: 'alliance',
    discordServerId: ashen,
    officerRoleId: officers,
  });
  const id = body(created).id;
  return {
    app,
    directory,
    storage,
    jobs,
    gmAgent,
    officerAgent: await loginAs(app, officer),
    id,
    /** The settings save, as the page sends it: multipart, with an optional image. */
    save: (agent: ReturnType<typeof request.agent>) => agent.patch(`/api/guilds/${id}`),
  };
}

function png(width = 400, height = 200) {
  return sharp({ create: { width, height, channels: 3, background: '#c8a14a' } })
    .withExif({ IFD0: { Artist: 'Thrall' } })
    .png()
    .toBuffer();
}

const asPng = { filename: 'crest.png', contentType: 'image/png' };

let sequelize: Sequelize;

beforeAll(() => {
  sequelize = createSequelize(process.env.DATABASE_URL!);
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await User.destroy({ truncate: true, cascade: true });
});

describe('PATCH /api/guilds/:guildId', () => {
  it('saves the name, the image, and the Officer role together', async () => {
    const { gmAgent, storage, save } = await setup();

    const response = await save(gmAgent)
      .field('name', '  Emberwatch ')
      .field('officerRoleId', managers)
      .attach('image', await png(), asPng);

    expect(response.status).toBe(200);
    expect(body(response)).toMatchObject({ name: 'Emberwatch', officerRole: { id: managers } });
    expect(body(response).imageUrl).toMatch(/\/image\?v=/);
    expect(storage.files.size).toBe(1);
  });

  it('saves nothing when one of the changes is invalid', async () => {
    const { gmAgent, storage, save, id } = await setup();

    const response = await save(gmAgent)
      .field('name', 'Emberwatch')
      .field('officerRoleId', '400000000000000099')
      .attach('image', await png(), asPng);

    expect(response.status).toBe(400);
    expect(body(response).error.issues).toEqual([
      { field: 'officerRoleId', code: 'OFFICER_ROLE_NOT_FOUND' },
    ]);
    const guild = await Guild.findByPk(id);
    expect([guild?.name, guild?.imageKey]).toEqual(['Ashen Vanguard', null]);
    expect(storage.files.size).toBe(0);
  });

  it("doesn't save the name when the image can't be read", async () => {
    const { gmAgent, save, id } = await setup();

    const response = await save(gmAgent)
      .field('name', 'Emberwatch')
      .attach('image', Buffer.from('<script>alert(1)</script>'), asPng);

    expect(response.status).toBe(400);
    expect(body(response).error.code).toBe('INVALID_IMAGE');
    expect((await Guild.findByPk(id))?.name).toBe('Ashen Vanguard');
  });

  it('needs the Officer role when the server changes', async () => {
    const { gmAgent, save } = await setup();

    const response = await save(gmAgent).field('discordServerId', ashen);

    expect(response.status).toBe(400);
    expect(body(response).error.issues).toEqual([{ field: 'officerRoleId', code: 'REQUIRED' }]);
  });

  it.each([
    ['an empty name', '', 'REQUIRED'],
    ['an offensive name', 'Los Pendejos', 'NAME_NOT_ALLOWED'],
  ])('rejects %s', async (_case, name, code) => {
    const { gmAgent, save } = await setup();

    const response = await save(gmAgent).field('name', name);

    expect(response.status).toBe(400);
    expect(body(response).error.issues).toEqual([expect.objectContaining({ field: 'name', code })]);
  });

  it('answers 403 to an Officer', async () => {
    const { officerAgent, save } = await setup();

    expect((await save(officerAgent).field('name', 'Mine')).status).toBe(403);
  });
});

describe('the events channel and Discord language', () => {
  /** An upcoming event of the guild, and a cancelled one. */
  async function events(guildId: string) {
    const columns = {
      guildId,
      type: 'raid' as const,
      name: 'Molten Core',
      description: '',
      size: 40,
      tankSlots: 4,
      healerSlots: 10,
      dpsSlots: 26,
      createdByUserId: null,
    };
    const later = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const upcoming = await Event.create({ ...columns, startsAt: later(3) });
    await Event.create({ ...columns, startsAt: later(4), cancelledAt: new Date() });
    return { upcoming };
  }

  it('starts without a channel, in English', async () => {
    const { gmAgent, id } = await setup();

    const response = await gmAgent.get(`/api/guilds/${id}`);

    expect(body(response)).toMatchObject({ eventsChannel: null, discordLocale: 'en' });
  });

  it('lists the channels where the bot can post', async () => {
    const { gmAgent } = await setup();

    const response = await gmAgent.get(`/api/discord/servers/${ashen}/channels`);

    expect(response.body).toEqual({
      channels: [{ id: raidsChannel, name: 'raid-signups', category: null }],
    });
  });

  it("doesn't list the channels of a server the user can't manage", async () => {
    const { officerAgent } = await setup();

    expect((await officerAgent.get(`/api/discord/servers/${ashen}/channels`)).status).toBe(403);
  });

  it('saves both, and asks for the posts of upcoming events', async () => {
    const { gmAgent, save, jobs, id } = await setup();
    const { upcoming } = await events(id);

    const response = await save(gmAgent)
      .field('eventsChannelId', raidsChannel)
      .field('discordLocale', 'es');

    expect(response.status).toBe(200);
    expect(body(response)).toMatchObject({
      eventsChannel: { id: raidsChannel, name: 'raid-signups' },
      discordLocale: 'es',
    });
    expect(jobs.payloads('event-post')).toEqual([{ eventId: upcoming.id }]);
  });

  it("doesn't touch the posts when nothing about them changed", async () => {
    const { gmAgent, save, jobs, id } = await setup();
    await events(id);

    await save(gmAgent).field('name', 'Emberwatch').field('discordLocale', 'en');

    expect(jobs.jobs).toEqual([]);
  });

  it("rejects a channel where the bot can't write", async () => {
    const { gmAgent, save, id } = await setup();

    const response = await save(gmAgent).field('eventsChannelId', readOnlyChannel);

    expect(response.status).toBe(400);
    expect(body(response).error.issues).toEqual([
      { field: 'eventsChannelId', code: 'EVENTS_CHANNEL_NOT_USABLE' },
    ]);
    expect((await Guild.findByPk(id))?.eventsChannelId).toBeNull();
  });

  it('leaves the guild without a channel when the server changes', async () => {
    const { gmAgent, save, directory, id } = await setup();
    const ember = '300000000000000002';
    directory
      .addServer(server(ember, 'Emberwatch', { roles: [role(managers, 'Managers')] }))
      .addMember(ember, gm, [managers]);
    directory.servers.get(ember)!.ownerId = gm;
    await save(gmAgent).field('eventsChannelId', raidsChannel);

    const response = await save(gmAgent)
      .field('discordServerId', ember)
      .field('officerRoleId', managers);

    expect(response.status).toBe(200);
    expect(body(response).eventsChannel).toBeNull();
    expect((await Guild.findByPk(id))?.eventsChannelId).toBeNull();
  });

  it.each([
    ['the events channel', 'eventsChannelId', raidsChannel],
    ['the Discord language', 'discordLocale', 'es'],
  ])("doesn't let an Officer change %s", async (_case, field, value) => {
    const { officerAgent, save } = await setup();

    expect((await save(officerAgent).field(field, value)).status).toBe(403);
  });
});

describe('the guild image', () => {
  it('stores the upload as a 256×256 WebP without its metadata, and serves it', async () => {
    const { gmAgent, officerAgent, save } = await setup();

    const response = await save(gmAgent).attach('image', await png(), asPng);

    const imageUrl = body(response).imageUrl!;
    const image = await officerAgent.get(imageUrl).buffer(true);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/webp');
    const metadata = await sharp(image.body as Buffer).metadata();
    expect([metadata.format, metadata.width, metadata.height]).toEqual(['webp', 256, 256]);
    expect(metadata.exif).toBeUndefined();
    expect(body(await officerAgent.get('/api/me')).guilds[0]?.imageUrl).toBe(imageUrl);
  });

  it('replaces the old image with a new URL, and removes the old file', async () => {
    const { gmAgent, storage, save } = await setup();
    const first = await save(gmAgent).attach('image', await png(), asPng);

    const second = await save(gmAgent).attach('image', await png(100, 300), asPng);

    expect(body(second).imageUrl).not.toBe(body(first).imageUrl);
    expect(storage.files.size).toBe(1);
  });

  it('removes the image', async () => {
    const { gmAgent, storage, save, id } = await setup();
    await save(gmAgent).attach('image', await png(), asPng);

    const response = await save(gmAgent).field('removeImage', 'true');

    expect(body(response).imageUrl).toBeNull();
    expect(storage.files.size).toBe(0);
    expect((await gmAgent.get(`/api/guilds/${id}/image`)).status).toBe(404);
  });

  it('rejects other file types with 415', async () => {
    const { gmAgent, save } = await setup();

    const response = await save(gmAgent).attach('image', Buffer.from('GIF89a'), {
      filename: 'crest.gif',
      contentType: 'image/gif',
    });

    expect(response.status).toBe(415);
    expect(body(response).error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects files over 5 MB with 413', async () => {
    const { gmAgent, save } = await setup();

    const response = await save(gmAgent).attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), asPng);

    expect(response.status).toBe(413);
    expect(body(response).error.code).toBe('FILE_TOO_LARGE');
  });

  it("doesn't let an Officer upload, or anyone without access see it", async () => {
    const { app, gmAgent, officerAgent, save } = await setup();
    const uploaded = await save(gmAgent).attach('image', await png(), asPng);

    const upload = await save(officerAgent).attach('image', await png(), asPng);
    const stranger = await loginAs(app, '200000000000000009');

    expect(upload.status).toBe(403);
    expect((await stranger.get(body(uploaded).imageUrl!)).status).toBe(403);
  });
});
