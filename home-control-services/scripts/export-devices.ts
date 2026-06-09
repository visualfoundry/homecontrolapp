// =============================================================================
// export-devices — generate devices.json from WPGraphQL + live EISY probing
//
// Usage:
//   npm run export-devices
//
// Requires .env with WP_GRAPHQL_URL, EISY_* URLs and EISY_USER/EISY_PASS.
//
// What it does:
//   1. Fetches all controls from WPGraphQL (same query as the Next.js app).
//   2. Maps each WP control to a DeviceEntry (device class, EISY index, address/varId).
//   3. For variable controls: probes each EISY to determine variable type (1=int, 2=state).
//   4. Writes devices.json — the aggregator service reads this at startup.
//
// Re-run whenever devices are added/changed in WordPress.
// =============================================================================

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVariables } from '../src/eisy-client.js';
import { EISY_URLS, WP_GRAPHQL_URL } from '../src/config.js';
import type { DeviceClass, DeviceEntry, DevicesMap } from '../src/state-mapper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// WPGraphQL fetch
// ---------------------------------------------------------------------------

const CONTROLS_QUERY = /* GraphQL */ `
  query ExportDevices($after: String) {
    controls(first: 500, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        databaseId
        title
        controlFields {
          controlIsy
          controlIsyControlType
          controlAddress
          controlVariableId
          controlType {
            nodes {
              ... on ControlType {
                title
                controlTypeFields { controlTypeClass }
              }
            }
          }
        }
      }
    }
  }
`;

interface ControlNode {
  databaseId: number;
  title: string;
  controlFields: {
    controlIsy: string[] | null;
    controlIsyControlType: string | null;
    controlAddress: string | null;
    controlVariableId: number | null;
    controlType: {
      nodes: Array<{
        title: string;
        controlTypeFields: { controlTypeClass: string | null } | null;
      }>;
    } | null;
  } | null;
}

async function fetchAllControls(): Promise<ControlNode[]> {
  if (!WP_GRAPHQL_URL) {
    throw new Error('WP_GRAPHQL_URL is not set in .env');
  }

  const all: ControlNode[] = [];
  let cursor: string | null = null;

  do {
    const variables: Record<string, unknown> = cursor ? { after: cursor } : {};
    const res = await fetch(WP_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: CONTROLS_QUERY, variables }),
    });
    if (!res.ok) throw new Error(`WPGraphQL HTTP ${res.status}`);

    const json = (await res.json()) as {
      data?: { controls: { nodes: ControlNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } };
      errors?: Array<{ message: string }>;
    };
    if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join(', '));
    if (!json.data) throw new Error('WPGraphQL returned no data');

    all.push(...json.data.controls.nodes);
    cursor = json.data.controls.pageInfo.hasNextPage
      ? json.data.controls.pageInfo.endCursor
      : null;
  } while (cursor !== null);

  return all;
}

// ---------------------------------------------------------------------------
// Control type title → DeviceClass
// ---------------------------------------------------------------------------

function titleToClass(ctTitle: string): DeviceClass {
  const t = ctTitle.toLowerCase();

  if (t === 'light dimmer')                       return 'light-dimmer';
  if (t.startsWith('light switch'))               return 'light-switch';
  if (t === 'door switch led')                    return 'light-dimmer'; // night LEDs
  if (t === 'fan')                                return 'fan';
  if (t === 'tv')                                 return 'toggle';
  if (t === 'speaker')                            return 'speaker';
  if (t === 'audio speaker volume')               return 'speaker';
  if (t === 'door exterior')                      return 'lock';
  if (t === 'door lock')                          return 'flag';       // auto-lock toggle
  if (t === 'door interior')                      return 'contact-sensor';
  if (t === 'garage car door')                    return 'contact-sensor';
  if (t === 'water leak sensor')                  return 'leak-sensor';
  if (t === 'motion sensor')                      return 'motion-sensor';
  if (t === 'thermostat control')                 return 'thermostat';
  if (t === 'override switch')                    return 'toggle';
  if (t === 'auto switch')                        return 'toggle';
  if (t === 'onoffswitch-climate')                return 'toggle';
  if (t === 'house-status' || t === 'house status' || t === 'button house status') return 'numeric-var';
  if (t.startsWith('geolocation'))                return 'flag';
  if (t === 'security')                           return 'flag';
  if (t === 'schedule')                           return 'flag';
  if (t === 'environment')                        return 'flag';
  if (t === 'house settings')                     return 'flag';
  if (t === 'irrigation program')                 return 'flag';
  if (t.startsWith('irrigation zone'))            return 'numeric-var'; // minutes
  if (/^light scene \d+ step$/i.test(t))           return 'numeric-var'; // scene intensity step
  if (t.startsWith('weather variable'))           return 'numeric-var';
  if (t.startsWith('current-'))                   return 'numeric-var';
  if (t === 'pool')                               return 'toggle';
  if (t === 'theatre-screen')                     return 'toggle';

  // Fallback: try to infer from ACF class field
  return 'flag';
}

// ---------------------------------------------------------------------------
// Build DevicesMap from WP controls
// ---------------------------------------------------------------------------

function buildDevicesMap(controls: ControlNode[]): {
  devices: DevicesMap;
  variableControls: Array<{ stateId: string; eisyIdx: number; varId: number }>;
} {
  const devices: DevicesMap = {};
  const variableControls: Array<{ stateId: string; eisyIdx: number; varId: number }> = [];

  for (const ctrl of controls) {
    const cf = ctrl.controlFields;
    if (!cf) continue;

    const eisyIdx = parseInt(cf.controlIsy?.[0] ?? '0', 10);
    const ctTitle = cf.controlType?.nodes[0]?.title ?? '';
    const cls = titleToClass(ctTitle);

    if (cf.controlIsyControlType === 'Device' && cf.controlAddress) {
      // FanLinc fan motor is always sub-node 1; WP stores the 3-byte base address
      // but EISY REST API requires the full node address including the node suffix.
      const address = cls === 'fan' ? `${cf.controlAddress} 1` : cf.controlAddress;
      const stateId = `eisy${eisyIdx}/${address}`;
      devices[stateId] = {
        type: 'device',
        eisyIdx,
        class: cls,
        address,
      };
    } else if (cf.controlIsyControlType === 'Variable' && cf.controlVariableId != null) {
      const stateId = `eisy${eisyIdx}/var/${cf.controlVariableId}`;
      // varType determined by probing — placeholder for now
      devices[stateId] = {
        type: 'variable',
        eisyIdx,
        class: cls,
        varId: cf.controlVariableId,
        varType: undefined, // filled in by probing below
      };
      variableControls.push({ stateId, eisyIdx, varId: cf.controlVariableId });
    }
  }

  return { devices, variableControls };
}

// ---------------------------------------------------------------------------
// Probe EISYs to determine variable types
// ---------------------------------------------------------------------------

async function probeVariableTypes(
  devices: DevicesMap,
  variableControls: Array<{ stateId: string; eisyIdx: number; varId: number }>,
): Promise<void> {
  // Group variable controls by EISY index to minimise requests
  const byEisy = new Map<number, typeof variableControls>();
  for (const vc of variableControls) {
    if (!byEisy.has(vc.eisyIdx)) byEisy.set(vc.eisyIdx, []);
    byEisy.get(vc.eisyIdx)!.push(vc);
  }

  for (const [eisyIdx, vcs] of byEisy) {
    const baseUrl = EISY_URLS[eisyIdx];
    console.log(`  [eisy${eisyIdx}] probing variable types at ${baseUrl}…`);

    let type1Map = new Map<number, number>();
    let type2Map = new Map<number, number>();

    try {
      type1Map = await getVariables(baseUrl, 1);
    } catch (e) {
      console.warn(`    type-1 probe failed: ${e instanceof Error ? e.message : e}`);
    }
    try {
      type2Map = await getVariables(baseUrl, 2);
    } catch (e) {
      console.warn(`    type-2 probe failed: ${e instanceof Error ? e.message : e}`);
    }

    for (const vc of vcs) {
      const entry = devices[vc.stateId];
      if (!entry) continue;

      if (type1Map.has(vc.varId) && !type2Map.has(vc.varId)) {
        entry.varType = 1;
      } else if (type2Map.has(vc.varId) && !type1Map.has(vc.varId)) {
        entry.varType = 2;
      } else if (type1Map.has(vc.varId) && type2Map.has(vc.varId)) {
        // Collision — default to type 2 (state) and warn
        console.warn(`    variable ${vc.varId} exists in both type-1 and type-2 — defaulting to type 2`);
        entry.varType = 2;
      } else {
        // Not found on this EISY — warn but keep the entry (may be on a different unit)
        console.warn(`    variable ${vc.varId} not found on eisy${eisyIdx}`);
        entry.varType = 2; // safe default
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Fetching controls from WPGraphQL…');
  const controls = await fetchAllControls();
  console.log(`  ${controls.length} controls fetched`);

  const { devices, variableControls } = buildDevicesMap(controls);
  console.log(`  ${Object.keys(devices).length} entries built (${variableControls.length} variables)`);

  if (variableControls.length > 0) {
    console.log('Probing EISYs for variable types…');
    await probeVariableTypes(devices, variableControls);
  }

  const outPath = join(__dirname, '..', 'devices.json');
  writeFileSync(outPath, JSON.stringify(devices, null, 2));
  console.log(`Written: ${outPath}`);
  console.log(`Done — ${Object.keys(devices).length} devices exported.`);
}

main().catch((err) => {
  console.error('export-devices failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
