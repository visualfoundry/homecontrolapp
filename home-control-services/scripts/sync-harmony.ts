// =============================================================================
// sync-harmony — refresh the Harmony device catalog from EISY 0.
//
// Run after adding, renaming or removing anything in the Harmony app:
//   npm run sync-harmony
//
// Writes two files:
//   devices.json                        — merges in the harmony hub/device entries
//   ../next-app/src/data/harmony.json   — the room→devices catalog the UI reads
//
// This MERGES rather than regenerates: devices.json also holds entries added by
// hand (motion-sensor battery sub-nodes, per the note in export-devices), and a
// full rebuild would silently drop them. Only harmony entries are touched.
// =============================================================================

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EISY_URLS } from '../src/config.js';
import { discoverHarmony } from '../src/harmony.js';
import type { DevicesMap } from '../src/state-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Harmony lives on EISY 0. */
const EISY_IDX = 0;

async function main() {
  const baseUrl = EISY_URLS[EISY_IDX];
  console.log(`Discovering Harmony on eisy${EISY_IDX} (${baseUrl})…`);

  const { devices, catalog } = await discoverHarmony(baseUrl, EISY_IDX);

  const entryCount = Object.keys(devices).length;
  const boxCount = Object.values(devices).filter(d => d.class === 'harmony-device').length;
  if (boxCount === 0) {
    console.error('No button-capable Harmony devices found — refusing to write.');
    process.exit(1);
  }

  console.log(`  ${catalog.hubs.length} hubs, ${boxCount} button-capable devices`);
  for (const hub of catalog.hubs) {
    console.log(`    ${hub.name}: ${hub.devices.map(d => d.name).join(', ') || '(none)'}`);
    console.log(`      activities: ${hub.activities.map(a => `${a.index}=${a.name}`).join(', ') || '(none — power off only)'}`);
  }
  for (const u of catalog.unprofiled) {
    console.warn(`  ~ ${u.hub} / ${u.name} (${u.address}) — no profile on the EISY; offered with every button until one is built`);
  }

  // --- devices.json: replace the harmony-device set, leave everything else ---
  const devicesPath = join(__dirname, '..', 'devices.json');
  const existing = JSON.parse(readFileSync(devicesPath, 'utf8')) as DevicesMap;

  let removed = 0;
  for (const [id, entry] of Object.entries(existing)) {
    if (entry.class === 'harmony-device' || entry.class === 'harmony-hub') {
      delete existing[id];
      removed++;
    }
  }
  Object.assign(existing, devices);
  writeFileSync(devicesPath, JSON.stringify(existing, null, 2));
  console.log(`Written: ${devicesPath} (-${removed} +${entryCount} harmony entries, ${Object.keys(existing).length} total)`);

  // --- UI catalog -----------------------------------------------------------
  const catalogPath = join(__dirname, '..', '..', 'next-app', 'src', 'data', 'harmony.json');
  mkdirSync(dirname(catalogPath), { recursive: true });
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Written: ${catalogPath}`);
}

main().catch((err) => {
  console.error('sync-harmony failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
