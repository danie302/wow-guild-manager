// Bundles the api, bot, and worker into dist/ for the production image (docs/deployment.md).
// @wgm/shared is TypeScript source with no build step, so it's bundled in; npm dependencies stay
// external and come from node_modules.
import { readFile } from 'node:fs/promises';

import { build } from 'esbuild';

const { dependencies } = JSON.parse(await readFile(new URL('package.json', import.meta.url)));

await build({
  entryPoints: ['src/entrypoints/api.ts', 'src/entrypoints/bot.ts', 'src/entrypoints/worker.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  external: Object.keys(dependencies).filter((name) => name !== '@wgm/shared'),
  logLevel: 'info',
});
