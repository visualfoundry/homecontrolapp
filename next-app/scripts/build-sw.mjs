// Stamp the service worker with the current build id.
//
// Reads sw.template.js, substitutes __HCA_BUILD_ID__, writes public/sw.js
// (generated — git-ignored). Runs after `next build`, because the id it needs is
// whatever `next build` just wrote to .next/BUILD_ID.
//
// Why this exists: an installed PWA is resumed, not re-navigated, so it keeps
// running the JS of whichever build it first loaded. The only lever that reaches
// it is the service worker — the browser refetches sw.js on reg.update() and
// installs a new worker only if the bytes differ. A static sw.js never differs,
// so deploys stayed invisible on the phone until it was force-quit. Stamping the
// build id makes every deploy a byte-different worker, which installs,
// skipWaiting()s, claims the page, and SwRegistrar reloads it into the new build.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const template = join(root, 'sw.template.js');
const out = join(root, 'public', 'sw.js');
const buildIdPath = join(root, '.next', 'BUILD_ID');

// In dev there is no BUILD_ID and no deploy to pick up, so a fixed marker keeps
// the worker stable across restarts instead of reinstalling on every boot.
const buildId = existsSync(buildIdPath)
  ? readFileSync(buildIdPath, 'utf8').trim()
  : 'dev';

if (!existsSync(template)) {
  console.error(`[build-sw] missing ${template}`);
  process.exit(1);
}

const src = readFileSync(template, 'utf8');
if (!src.includes('__HCA_BUILD_ID__')) {
  console.error('[build-sw] sw.template.js has no __HCA_BUILD_ID__ placeholder');
  process.exit(1);
}

writeFileSync(out, src.replaceAll('__HCA_BUILD_ID__', buildId));
console.log(`[build-sw] public/sw.js stamped with build ${buildId}`);
