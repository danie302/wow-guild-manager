/**
 * Uploads the class and role icons of event posts as the bot application's own emojis:
 * `docker compose exec api pnpm --filter @wgm/server discord:emojis`. It reads
 * `assets/emojis/<name>.png` (or .jpg, .gif), where the name is a class (`mage`) or a role
 * (`tank`), and uploads each one the app doesn't have yet as `wgm_<name>`. Posts pick them up
 * within the hour. See assets/emojis/README.md.
 */
import { readdir, readFile } from 'node:fs/promises';
import { extname, basename, join } from 'node:path';

import { CLASSES, COMBAT_ROLES } from '@wgm/shared';

import { createRestAppEmojis, EMOJI_PREFIX } from '../integrations/discord/app-emojis.js';

const DIRECTORY = new URL('../../assets/emojis/', import.meta.url).pathname;
const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
};
/** Discord's limit for an emoji image. */
const MAX_BYTES = 256 * 1024;
const NAMES: readonly string[] = [...CLASSES, ...COMBAT_ROLES];

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('DISCORD_BOT_TOKEN is not set.');
  process.exit(1);
}

const emojis = createRestAppEmojis(token);
const existing = await emojis.list();
const files = (await readdir(DIRECTORY)).filter((file) => TYPES[extname(file).toLowerCase()]);
if (files.length === 0) console.log(`No icons in ${DIRECTORY}. See the README there.`);
for (const file of files.sort()) {
  const type = TYPES[extname(file).toLowerCase()]!;
  const name = basename(file, extname(file)).toLowerCase();
  if (!NAMES.includes(name)) {
    console.warn(`Skipped ${file}: name it after a class (${CLASSES.join(', ')}) or a role.`);
    continue;
  }
  if (existing.has(EMOJI_PREFIX + name)) {
    console.log(`${EMOJI_PREFIX}${name} is already uploaded.`);
    continue;
  }
  const image = await readFile(join(DIRECTORY, file));
  if (image.length > MAX_BYTES) {
    console.warn(`Skipped ${file}: it's over 256 KB.`);
    continue;
  }
  await emojis.upload(EMOJI_PREFIX + name, image, type);
  console.log(`Uploaded ${EMOJI_PREFIX}${name}.`);
}
