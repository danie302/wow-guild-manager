import type { Sequelize } from 'sequelize';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loginAs, testApp } from '../../../test/api-app.js';
import {
  FakeDiscordDirectory,
  MANAGE_GUILD,
  role,
  server,
} from '../../../test/fake-discord-directory.js';
import { Guild, User } from '../../db/models/index.js';
import { createSequelize } from '../../db/sequelize.js';
import { memoryFileStorage } from '../../storage/file-storage.js';

const gm = '200000000000000001';
const officer = '200000000000000002';
const ashen = '300000000000000001';
const officers = '400000000000000001';
const managers = '400000000000000002';

interface Body {
  id: string;
  name: string;
  imageUrl: string | null;
  officerRole: { id: string };
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
    .addMember(ashen, officer, [officers]);
  const storage = memoryFileStorage();
  const app = testApp({ directory, botInviteUrl: 'https://discord.test/invite' }, storage);
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
    storage,
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
