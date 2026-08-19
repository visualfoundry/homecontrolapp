// =============================================================================
// Harmony discovery
//
// The Logitech Harmony plugin on EISY 0 publishes a node per hub, per activity
// and per device. Unlike every other device class in this system, these nodes
// have no WordPress control behind them — the plugin already knows each device's
// name and which hub (room) it belongs to, so the catalog is discovered from the
// EISY instead of authored twice.
//
// Only device nodes matter for the remote: hubs accept SET_ACTIVITY but not
// SET_BUTTON, and activity nodes accept only DON/DOF. Buttons must be addressed
// to a specific device node.
// =============================================================================

import { getNodeDefinitions, getProfiles } from './eisy-client.js';
import type { DevicesMap } from './state-mapper.js';

/** Family/instance of the Harmony plugin's profile in /rest/profiles. */
const HARMONY_FAMILY = '10';

export interface HarmonyDeviceInfo {
  /** State-service id, e.g. "eisy0/n011_d52305979". */
  id: string;
  name: string;
}

export interface HarmonyHubInfo {
  id: string;
  name: string;
  devices: HarmonyDeviceInfo[];
}

export interface HarmonyCatalog {
  hubs: HarmonyHubInfo[];
  /** Devices the plugin lists but whose profile carries no SET_BUTTON — they
   *  need a profile rebuild on the EISY before a remote can drive them. */
  unusable: Array<{ name: string; hub: string; address: string }>;
}

export interface HarmonyDiscovery {
  /** devices.json entries, keyed by state id. */
  devices: DevicesMap;
  catalog: HarmonyCatalog;
}

/**
 * Discover the Harmony hubs and their button-capable devices on one EISY.
 * Returns empty results (rather than throwing) when the plugin isn't installed.
 */
export async function discoverHarmony(
  baseUrl: string,
  eisyIdx: number,
): Promise<HarmonyDiscovery> {
  const empty: HarmonyDiscovery = { devices: {}, catalog: { hubs: [], unusable: [] } };

  const nodes = await getNodeDefinitions(baseUrl);
  const controller = nodes.find(n => n.nodeDefId === 'HarmonyController');
  if (!controller) return empty;

  // The plugin's instance prefix, e.g. "n011" — not fixed across installs.
  const prefix = controller.address.split('_')[0];
  if (!prefix) return empty;

  const hubRe    = new RegExp(`^${prefix}_h[0-9a-f]+$`, 'i');
  const deviceRe = new RegExp(`^${prefix}_d\\d+$`);

  // Which nodedefs actually accept SET_BUTTON. A hub whose profile hasn't been
  // rebuilt since its devices were added lists the nodes but defines no commands
  // for them, and a button sent there would fail silently.
  const buttonCapable = new Set<string>();
  try {
    const profiles = await getProfiles(baseUrl);
    const fam = profiles.families?.find(f => f.id === HARMONY_FAMILY);
    for (const inst of fam?.instances ?? []) {
      for (const nd of inst.nodedefs ?? []) {
        if (nd.cmds?.accepts?.some(a => a.id === 'SET_BUTTON')) buttonCapable.add(nd.id);
      }
    }
  } catch {
    // Profile unreadable — treat every device as usable rather than dropping the
    // whole catalog; a bad button is a no-op, a missing remote is a regression.
    return buildResult(nodes, eisyIdx, hubRe, deviceRe, null);
  }

  return buildResult(nodes, eisyIdx, hubRe, deviceRe, buttonCapable);
}

function buildResult(
  nodes: Awaited<ReturnType<typeof getNodeDefinitions>>,
  eisyIdx: number,
  hubRe: RegExp,
  deviceRe: RegExp,
  buttonCapable: Set<string> | null,
): HarmonyDiscovery {
  const devices: DevicesMap = {};
  const hubs: HarmonyHubInfo[] = [];
  const unusable: HarmonyCatalog['unusable'] = [];

  const hubNodes = nodes.filter(n => hubRe.test(n.address));

  for (const hub of hubNodes) {
    const hubInfo: HarmonyHubInfo = {
      id: `eisy${eisyIdx}/${hub.address}`,
      name: hub.name,
      devices: [],
    };

    for (const dev of nodes) {
      if (!deviceRe.test(dev.address) || dev.parent !== hub.address) continue;

      if (buttonCapable && !buttonCapable.has(dev.nodeDefId)) {
        unusable.push({ name: dev.name, hub: hub.name, address: dev.address });
        continue;
      }

      const stateId = `eisy${eisyIdx}/${dev.address}`;
      devices[stateId] = {
        type: 'device',
        eisyIdx,
        class: 'harmony-device',
        address: dev.address,
        name: dev.name,
        hub: hub.name,
      };
      hubInfo.devices.push({ id: stateId, name: dev.name });
    }

    hubs.push(hubInfo);
  }

  hubs.sort((a, b) => a.name.localeCompare(b.name));
  return { devices, catalog: { hubs, unusable } };
}
