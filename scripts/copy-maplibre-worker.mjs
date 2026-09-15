import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('maplibre-gl/package.json'));
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'apps/public-site/public/maplibre');
await mkdir(destination, { recursive: true });
// Keep the worker and its relative ESM import together, at the installed version.
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  await copyFile(resolve(packageRoot, 'dist', file), resolve(destination, file));
}
await copyFile(resolve(packageRoot, 'LICENSE.txt'), resolve(destination, 'LICENSE.txt'));
