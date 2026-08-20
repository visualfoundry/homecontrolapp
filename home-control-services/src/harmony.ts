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
import { HARMONY_BUTTONS } from './state-mapper.js';
import type { DevicesMap, HarmonyButton } from './state-mapper.js';

/** Family/instance of the Harmony plugin's profile in /rest/profiles. */
const HARMONY_FAMILY = '10';

export interface HarmonyDeviceInfo {
  /** State-service id, e.g. "eisy0/n011_d52305979". */
  id: string;
  name: string;
  /** Which of the remote's buttons this box actually has an IR code for. The
   *  hub takes any index in the shared table but only acts on its own, so this
   *  is what stops the UI offering a key that goes nowhere. */
  buttons: HarmonyButton[];
  /** False when the EISY publishes no profile for this node, so `buttons` is the
   *  full set on spec rather than the device's own list. The node still accepts
   *  SET_BUTTON — the plugin created it, only the profile wasn't rebuilt — so
   *  these stay usable, just guessed. */
  buttonsKnown: boolean;
}

export interface HarmonyHubInfo {
  id: string;
  name: string;
  devices: HarmonyDeviceInfo[];
}

export interface HarmonyCatalog {
  hubs: HarmonyHubInfo[];
  /** Devices the plugin lists but the EISY publishes no profile for. Offered
   *  with the full button set until a profile rebuild on the EISY says which
   *  keys they really have. */
  unprofiled: Array<{ name: string; hub: string; address: string }>;
}

export interface HarmonyDiscovery {
  /** devices.json entries, keyed by state id. */
  devices: DevicesMap;
  catalog: HarmonyCatalog;
}

/** Expand an ISY editor subset ("0-4,21-24,77") into the indexes it allows. */
function expandSubset(subset: string): number[] {
  const out: number[] = [];
  for (const part of subset.split(',')) {
    const [from, to] = part.split('-');
    const a = Number(from);
    if (!Number.isFinite(a)) continue;
    const b = to === undefined ? a : Number(to);
    for (let i = a; i <= (Number.isFinite(b) ? b : a); i++) out.push(i);
  }
  return out;
}

/** Reverse of HARMONY_BUTTONS: table index → the name the remote calls it. */
const BUTTON_BY_INDEX = new Map<number, HarmonyButton>(
  (Object.entries(HARMONY_BUTTONS) as Array<[HarmonyButton, number]>).map(([n, i]) => [i, n]),
);

/**
 * Discover the Harmony hubs and their button-capable devices on one EISY.
 * Returns empty results (rather than throwing) when the plugin isn't installed.
 */
export async function discoverHarmony(
  baseUrl: string,
  eisyIdx: number,
): Promise<HarmonyDiscovery> {
  const empty: HarmonyDiscovery = { devices: {}, catalog: { hubs: [], unprofiled: [] } };

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
  // nodedef → the remote buttons that device advertises, from its own SET_BUTTON
  // editor. Each device gets its own editor whose `subset` lists the indexes the
  // hub learned for it; anything outside it is a 404 from the EISY.
  const buttonsByNodeDef = new Map<string, HarmonyButton[]>();
  try {
    const profiles = await getProfiles(baseUrl);
    const fam = profiles.families?.find(f => f.id === HARMONY_FAMILY);
    for (const inst of fam?.instances ?? []) {
      const editors = new Map((inst.editors ?? []).map(e => [e.id, e]));
      for (const nd of inst.nodedefs ?? []) {
        const setButton = nd.cmds?.accepts?.find(a => a.id === 'SET_BUTTON');
        if (!setButton) continue;
        buttonCapable.add(nd.id);

        const editor = editors.get(setButton.parameters?.[0]?.editor ?? '');
        const subset = editor?.ranges?.[0]?.subset;
        if (!subset) continue;
        const buttons = expandSubset(subset)
          .map(i => BUTTON_BY_INDEX.get(i))
          .filter((b): b is HarmonyButton => b !== undefined);
        buttonsByNodeDef.set(nd.id, buttons);
      }
    }
  } catch {
    // Profile unreadable — treat every device as usable rather than dropping the
    // whole catalog; a bad button is a no-op, a missing remote is a regression.
    return buildResult(nodes, eisyIdx, hubRe, deviceRe, null, buttonsByNodeDef);
  }

  return buildResult(nodes, eisyIdx, hubRe, deviceRe, buttonCapable, buttonsByNodeDef);
}

function buildResult(
  nodes: Awaited<ReturnType<typeof getNodeDefinitions>>,
  eisyIdx: number,
  hubRe: RegExp,
  deviceRe: RegExp,
  buttonCapable: Set<string> | null,
  buttonsByNodeDef: Map<string, HarmonyButton[]>,
): HarmonyDiscovery {
  const devices: DevicesMap = {};
  const hubs: HarmonyHubInfo[] = [];
  const unprofiled: HarmonyCatalog['unprofiled'] = [];

  const hubNodes = nodes.filter(n => hubRe.test(n.address));

  for (const hub of hubNodes) {
    const hubInfo: HarmonyHubInfo = {
      id: `eisy${eisyIdx}/${hub.address}`,
      name: hub.name,
      devices: [],
    };

    for (const dev of nodes) {
      if (!deviceRe.test(dev.address) || dev.parent !== hub.address) continue;

      // A node the EISY has no profile for is still driveable — the plugin owns
      // the hub connection and answers SET_BUTTON regardless (verified against
      // the Pergola's nodes, which the profile omits entirely). Take it, and
      // note that its button list is the spec rather than the device's own.
      const profiled = !buttonCapable || buttonCapable.has(dev.nodeDefId);
      if (!profiled) unprofiled.push({ name: dev.name, hub: hub.name, address: dev.address });

      const stateId = `eisy${eisyIdx}/${dev.address}`;
      devices[stateId] = {
        type: 'device',
        eisyIdx,
        class: 'harmony-device',
        address: dev.address,
        name: dev.name,
        hub: hub.name,
      };
      // No editor read means "unknown", not "none" — claim every button rather
      // than leaving the room with a dead remote.
      const known = buttonsByNodeDef.get(dev.nodeDefId);
      hubInfo.devices.push({
        id: stateId,
        name: dev.name,
        buttons: known ?? (Object.keys(HARMONY_BUTTONS) as HarmonyButton[]),
        buttonsKnown: known !== undefined,
      });
    }

    hubs.push(hubInfo);
  }

  hubs.sort((a, b) => a.name.localeCompare(b.name));
  return { devices, catalog: { hubs, unprofiled } };
}
