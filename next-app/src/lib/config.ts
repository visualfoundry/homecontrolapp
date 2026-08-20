// =============================================================================
// Config fetcher — Home Control App
//
// fetchConfig() is called by Server Components (page.tsx) at build/ISR time.
// Returns real WP data or an empty config (no devices shown) on failure.
// =============================================================================

import { gqlAllControls, HOME_CONFIG_QUERY, GraphQLError } from '@/lib/graphql';

import harmonyCatalog from '@/data/harmony.json';
import { REMOTE_BUTTONS } from '@/types/config';
import type { AppConfig, ControlNodeRaw, SceneRoomType, SceneRoomConfig, RemoteConfig, RemoteButton, RemoteDevice } from '@/types/config';

/** Shape of src/data/harmony.json, written by home-control-services sync-harmony. */
interface HarmonyCatalogRaw {
  hubs: Array<{
    id: string;
    name: string;
    devices: Array<{ id: string; name: string; buttons?: string[]; buttonsKnown?: boolean }>;
  }>;
  unprofiled: Array<{ name: string; hub: string; address: string }>;
}

// ---------------------------------------------------------------------------
// Transform WPGraphQL response → AppConfig
// ---------------------------------------------------------------------------

// Places considered exterior for door grouping / light grouping
const EXTERIOR_PLACES = new Set([
  'Back Yard', 'Driveway', 'Front Porch', 'Outdoors', 'Pergola', 'Porch', 'Garage',
]);

// Infer SceneRoomConfig metadata from a room display name.
function inferSceneRoom(id: string, name: string): SceneRoomConfig {
  const n = name.toLowerCase();
  let type: SceneRoomType;
  let hasDoor: boolean;
  let hasNightDim: boolean;

  if (n.includes('bedroom') || n.includes('closet')) {
    type = 'bedroom'; hasDoor = true; hasNightDim = n.includes('bedroom');
  } else if (n.includes('bathroom') || n.includes('powder room')) {
    type = 'bath'; hasDoor = true; hasNightDim = n.includes('guest');
  } else if (n.includes('kitchen') || n.includes('pantry')) {
    type = 'kitchen'; hasDoor = n.includes('pantry'); hasNightDim = false;
  } else if (n.includes('hall')) {
    type = 'hall'; hasDoor = false; hasNightDim = false;
  } else if (/back yard|backyard|driveway|porch|pergola|exterior/.test(n)) {
    type = 'outdoor'; hasDoor = false; hasNightDim = false;
  } else if (/laundry|gym|studio|sewing|mud room|mudroom|garage/.test(n)) {
    type = 'utility'; hasDoor = true; hasNightDim = false;
  } else {
    // living room, cinema, dining room, library
    type = 'living'; hasDoor = !n.includes('living room'); hasNightDim = false;
  }

  return { id, name, type, hasDoor, hasNightDim };
}


// ---------------------------------------------------------------------------
// Harmony remote join
//
// The catalog is discovered from the EISY plugin (npm run sync-harmony in
// home-control-services), not authored in WP — the plugin already knows each
// device's name and room, and re-running discovery keeps it in step with the
// Harmony app.
// ---------------------------------------------------------------------------

/** WP place → Harmony hub name, where the two don't match verbatim. */
const HUB_ALIASES: Record<string, string> = {
  'Guest Bedroom': 'Guest Room',
};

/** Devices whose IR carries volume — the amp wins over the TV when a room has one. */
const VOLUME_HINT = /amp|receiver|avr|audio|sound|soundbar/i;
/** Source boxes, which own the D-pad and transport keys. */
const NAV_HINT = /apple ?tv|fire ?tv|roku|shield|oppo|blu-?ray|xbox|playstation|stb|dvr|cable|sat/i;
/** Not real remote targets even though the hub lists them as devices. */
const NOT_A_TARGET = /light contr|projector screen|elite screens/i;

/** Volume/mute go to the amp when there is one; everything else to the source box. */
const VOLUME_GROUP: RemoteButton[] = ['VolumeUp', 'VolumeDown', 'Mute'];

function remoteForPlace(place: string | null): RemoteConfig | undefined {
  if (!place) return undefined;
  const hubName = HUB_ALIASES[place] ?? place;
  const hub = (harmonyCatalog as HarmonyCatalogRaw).hubs.find(h => h.name === hubName);
  if (!hub) return undefined;

  // A box that advertises no button the remote offers is not a target, however
  // the hub lists it (the Insteon bridge node is the usual case).
  const devices: RemoteDevice[] = hub.devices
    .filter(d => !NOT_A_TARGET.test(d.name))
    .map(d => ({
      id: d.id,
      name: d.name,
      buttons: (d.buttons ?? []) as RemoteButton[],
      buttonsKnown: d.buttonsKnown !== false,
    }))
    .filter(d => d.buttons.length > 0);
  if (devices.length === 0) return undefined;

  // A display, as opposed to a source box. Tested against NAV_HINT first because
  // "Apple TV" contains "TV" — without that exclusion a room whose only display
  // is a Sony TV would still route volume to the Apple TV sitting under it.
  const isDisplay = (name: string) => /tv|projector|display/i.test(name) && !NAV_HINT.test(name);

  // Preference order per group, then the first box that actually has the code —
  // the Studio's Apple TV has no volume and its Yamaha amp has nothing else, so
  // a single target per group is not enough on its own.
  const volumeFirst = [
    ...devices.filter(d => VOLUME_HINT.test(d.name)),
    ...devices.filter(d => isDisplay(d.name)),
    ...devices,
  ];
  const navFirst = [
    ...devices.filter(d => NAV_HINT.test(d.name)),
    ...devices.filter(d => isDisplay(d.name)),
    ...devices,
  ];

  const routes: Partial<Record<RemoteButton, string>> = {};
  for (const b of REMOTE_BUTTONS) {
    const order = VOLUME_GROUP.includes(b) ? volumeFirst : navFirst;
    // A box whose profile the EISY never built claims every button, so it only
    // gets one no profiled box in the room claims — otherwise the Pergola-style
    // guess would outrank a device that demonstrably has the code.
    const target = order.find(d => d.buttonsKnown && d.buttons.includes(b))
      ?? order.find(d => d.buttons.includes(b));
    if (target) routes[b] = target.id;
  }
  // Every box present but not one usable key — no remote rather than a dead one.
  if (Object.keys(routes).length === 0) return undefined;

  return { hubId: hub.id, hubName: hub.name, devices, routes };
}


function toAppConfig(controls: ControlNodeRaw[]): AppConfig {

  // Helper: get the place title for a control node
  const getPlace = (n: (typeof controls)[0]) =>
    n.controlFields?.controlPlace?.nodes[0]?.title ?? null;

  // Helper: device id is the WP database id (stable, matches state service)
  const toId = (n: (typeof controls)[0]) => String(n.databaseId);

  // --- Build place → (control-type title → device ID) lookup ---------------
  // Used to attach associated controls to each scene room.
  // First occurrence wins for places with multiple sensors of the same type.
  const SCENE_ASSOC_TYPES = new Set([
    'Motion Sensor', 'Override Switch', 'Auto Switch', 'Door Interior', 'Door Switch LED', 'Timer Wait',
  ]);
  const controlsByPlaceType = new Map<string, Map<string, string>>();
  for (const n of controls) {
    const place = getPlace(n) ?? '';
    if (!place) continue;
    const ctTitle = n.controlFields?.controlType?.nodes[0]?.title ?? '';
    if (!SCENE_ASSOC_TYPES.has(ctTitle)) continue;
    if (!controlsByPlaceType.has(place)) controlsByPlaceType.set(place, new Map());
    const byType = controlsByPlaceType.get(place)!;
    if (!byType.has(ctTitle)) byType.set(ctTitle, toId(n));
  }

  // --- Light scene controls (Light Scene N Step) --------------------------
  const SCENE_STEPS_RE = /Light Scene (\d+) Step/i;

  const sceneByPlace = new Map<string, { id: string; steps: number }>();
  const lightSceneRoomsRaw: Array<{ id: string; name: string; steps: number }> = [];
  const sceneRoomsRaw: SceneRoomConfig[] = [];

  for (const n of controls) {
    const ctTitle = n.controlFields?.controlType?.nodes[0]?.title ?? '';
    const match = SCENE_STEPS_RE.exec(ctTitle);
    if (!match) continue;

    const id = toId(n);
    const steps = parseInt(match[1], 10);
    const displayName = n.title.replace(/\s+Lights?\s+Scene\s*$/i, '').trim();
    const place = getPlace(n) ?? '';

    if (place) sceneByPlace.set(place, { id, steps });
    lightSceneRoomsRaw.push({ id, name: displayName, steps });

    const room = inferSceneRoom(id, displayName);
    room.steps = steps;
    if (place) room.place = place;
    if (place) {
      const byType = controlsByPlaceType.get(place) ?? new Map();
      const motionId    = byType.get('Motion Sensor');
      const switchId    = byType.get('Override Switch');
      const autoId      = byType.get('Auto Switch');
      const doorId      = byType.get('Door Interior');
      const nightDimId  = byType.get('Door Switch LED');
      const timerWaitId = byType.get('Timer Wait');
      if (motionId)    room.motionId    = motionId;
      if (switchId)    room.switchId    = switchId;
      if (autoId)      room.autoId      = autoId;
      if (doorId)      room.doorId      = doorId;
      if (nightDimId)  room.nightDimId  = nightDimId;
      if (timerWaitId) room.timerWaitId = timerWaitId;
      // Sync booleans with actual presence (used by mock fallback path)
      room.hasDoor    = !!doorId;
      room.hasNightDim = !!nightDimId;
    }
    sceneRoomsRaw.push(room);
  }

  // Sort both lists alphabetically by name
  lightSceneRoomsRaw.sort((a, b) => a.name.localeCompare(b.name));
  sceneRoomsRaw.sort((a, b) => a.name.localeCompare(b.name));

  const LIGHT_CT_TITLES = new Set([
    'Light Dimmer', 'Light Switch', 'Light Switch Exterior', 'Light Switch Garden',
  ]);
  const lightControls = controls.filter(
    n => LIGHT_CT_TITLES.has(n.controlFields?.controlType?.nodes[0]?.title ?? ''),
  );
  const lightsByPlace = new Map<string, { id: string; name: string; kind: 'dimmer' | 'switch' }[]>();
  for (const n of lightControls) {
    const place = getPlace(n) ?? 'Other';
    const ctTitle = n.controlFields?.controlType?.nodes[0]?.title ?? '';
    const kind: 'dimmer' | 'switch' = ctTitle === 'Light Dimmer' ? 'dimmer' : 'switch';
    if (!lightsByPlace.has(place)) lightsByPlace.set(place, []);
    lightsByPlace.get(place)!.push({ id: toId(n), name: n.title, kind });
  }
  const lightRooms = Array.from(lightsByPlace.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([room, lights]) => ({
      room,
      lights,
      ...(sceneByPlace.has(room) ? { scene: sceneByPlace.get(room) } : {}),
    }));

  // --- Doors (exterior locks + per-door auto-lock + open/closed sensor) ---
  // 'Door Exterior' is the parent record for each exterior door AND its open/closed variable.
  // 'Door Lock Status' (child, same place) holds the locked/unlocked variable → door.id.
  // 'Door Lock Auto Lock' (child, same place) holds the auto-lock toggle → door.autoLockId.
  const doorLockStatusByPlace = new Map<string, string>();
  for (const n of controls) {
    if ((n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Door Lock Status') {
      const place = getPlace(n);
      if (place) doorLockStatusByPlace.set(place, toId(n));
    }
  }
  const autoLockByPlace = new Map<string, string>();
  for (const n of controls) {
    if ((n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Door Lock Auto Lock') {
      const place = getPlace(n);
      if (place) autoLockByPlace.set(place, toId(n));
    }
  }
  const doorsExterior = controls
    .filter(n =>
      (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Door Exterior',
    )
    .flatMap(n => {
      const place = getPlace(n) ?? '';
      const lockId = doorLockStatusByPlace.get(place);
      if (!lockId) return [];
      const autoLockId = autoLockByPlace.get(place);
      return [{
        id: lockId, name: n.title, openId: toId(n),
        ...(autoLockId ? { autoLockId } : {}),
      }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Doors (interior sensors) -------------------------------------------
  const doorsInterior = controls
    .filter(n => (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Door Interior')
    .map(n => ({ id: toId(n), name: n.title }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Climate (HVAC zones) -----------------------------------------------
  const climate = controls
    .filter(n => (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Thermostat Control')
    .map(n => ({ id: toId(n), name: n.title }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Fans ---------------------------------------------------------------
  const fans = controls
    .filter(n => (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Fan')
    .map(n => ({ id: toId(n), name: n.title }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- TVs ----------------------------------------------------------------
  // On/off runs through an EISY variable per room. The remote buttons are a
  // separate, more direct path: straight to the Harmony device nodes on that
  // room's hub (see home-control-services/src/harmony.ts). The two are joined on
  // the WP place matching the hub name the Harmony app reports.
  const tvs = controls
    .filter(n => (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'TV')
    .map(n => {
      const remote = remoteForPlace(getPlace(n));
      return { id: toId(n), name: n.title, ...(remote ? { remote } : {}) };
    });

  // --- Audio / music zones ------------------------------------------------
  const musicZones = controls
    .filter(n => (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Speaker')
    .map(n => ({ id: toId(n), name: n.title }));

  // --- Irrigation programs ------------------------------------------------
  const irrigationPrograms = controls
    .filter(n => (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Irrigation Program')
    .map(n => ({ id: toId(n), name: n.title }));

  // --- Irrigation zones (control-type titles 'Irrigation Zone 1'–'8') -----
  const IRRIGATION_ZONE_RE = /^Irrigation Zone [1-8]$/i;
  const irrigationZones = controls
    .filter(n => IRRIGATION_ZONE_RE.test(n.controlFields?.controlType?.nodes[0]?.title ?? ''))
    .sort((a, b) => {
      const numA = parseInt((a.controlFields?.controlType?.nodes[0]?.title ?? '').replace(/\D/g, '') || '0');
      const numB = parseInt((b.controlFields?.controlType?.nodes[0]?.title ?? '').replace(/\D/g, '') || '0');
      return numA - numB;
    })
    .map(n => ({ id: toId(n), name: n.title }));

  // --- Leak sensors -------------------------------------------------------
  const leakSensors = controls
    .filter(n => (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Water Leak Sensor')
    .map(n => ({ id: toId(n), name: n.title }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Motion sensors -----------------------------------------------------
  const motionSensors = controls
    .filter(n => (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Motion Sensor')
    .map(n => ({ id: toId(n), name: n.title }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Pool controls: control type 'Pool Light' or 'Pool Waterfall' (no place filter)
  const POOL_LIGHT_CT_TITLES = new Set(['Pool Light', 'Pool Waterfall']);
  const poolIconFor = (ctTitle: string): import('@/components/Icon').IconName => {
    const t = ctTitle.toLowerCase();
    if (t.includes('light')) return 'bulb';
    if (t.includes('waterfall')) return 'waterfall';
    return 'pool';
  };
  const outdoorsPool = controls
    .filter(n => {
      const ct = n.controlFields?.controlType?.nodes[0]?.title ?? '';
      return POOL_LIGHT_CT_TITLES.has(ct);
    })
    .map(n => ({
      id: toId(n), name: n.title, kind: 'toggle' as const,
      icon: poolIconFor(n.controlFields?.controlType?.nodes[0]?.title ?? ''),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Pool valves: control type 'Pool Valve' (hardware address, open/close sub-nodes) ---
  // openValue/closeValue are Insteon sub-node numbers (1, 2, 3…) on the base hardware address.
  // Each sub-node is a separate EISY address: eisy{N}/{baseAddr} {subNode}.
  const poolValves = controls
    .filter(n => (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Pool Valve')
    .map(n => {
      const cf = n.controlFields!;
      const eisyIdx = cf.controlIsy?.[0] ?? '0';
      const baseAddr = (cf.controlAddress ?? '').trim();
      const openSub  = Number(cf.controlVariableHardwareValueOpen  ?? 0);
      const closeSub = Number(cf.controlVariableHardwareValueClose ?? 0);
      return {
        id: toId(n),
        name: n.title,
        openStateId:  openSub  > 0 && baseAddr ? `eisy${eisyIdx}/${baseAddr} ${openSub}`  : '',
        closeStateId: closeSub > 0 && baseAddr ? `eisy${eisyIdx}/${baseAddr} ${closeSub}` : '',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Backyard controls: places Back Yard/Porch/Pergola + specific types --
  const BACKYARD_PLACES = new Set(['Back Yard', 'Porch', 'Pergola']);
  const BACKYARD_CT_TITLES = new Set(['Outdoors', 'Fan', 'TV']);
  const BACKYARD_ICON: Record<string, import('@/components/Icon').IconName> = {
    Outdoors: 'bulb', Fan: 'fan', TV: 'tv',
  };
  const outdoorsBackyard = controls
    .filter(n => {
      const place = getPlace(n) ?? '';
      const ct = n.controlFields?.controlType?.nodes[0]?.title ?? '';
      return BACKYARD_PLACES.has(place) && BACKYARD_CT_TITLES.has(ct);
    })
    .map(n => {
      const ct = n.controlFields?.controlType?.nodes[0]?.title ?? '';
      const nameIcon: import('@/components/Icon').IconName =
        n.title.toLowerCase().includes('water') ? 'waterSpout' : (BACKYARD_ICON[ct] ?? 'bulb');
      return {
        id: toId(n), name: n.title,
        kind: 'toggle' as const,
        icon: nameIcon,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Who's Home: all Geolocation controls (any 'Geolocation *' control type)
  const whoIsHome = controls
    .filter(n => /^Geolocation\b/i.test(n.controlFields?.controlType?.nodes[0]?.title ?? ''))
    .map(n => ({ id: toId(n), name: n.title }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- People (presence): all 'Geolocation' control type controls ----------
  // WP control titles are "Geo <Name> at Home" → extract the person name.
  const people = controls
    .filter(n => /^Geolocation\b/i.test(n.controlFields?.controlType?.nodes[0]?.title ?? ''))
    .map(n => ({
      id: toId(n),
      name: n.title.replace(/^Geo\s+/i, '').replace(/\s+at\s+home$/i, '').trim(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Settings: grouped by control type ---------------------------------
  // Each Settings tile lists controls whose control type matches its name.
  const ctTitle = (n: (typeof controls)[0]) =>
    n.controlFields?.controlType?.nodes[0]?.title ?? '';
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const settingsByType = (type: string) =>
    controls
      .filter(n => ctTitle(n) === type)
      .map(n => ({ id: toId(n), name: n.title }))
      .sort(byName);
  const settingsSecurity    = settingsByType('Security');
  const settingsHouse       = settingsByType('House Settings');
  const settingsSchedules   = settingsByType('Schedule');
  const settingsEnvironment = settingsByType('Environment');

  // --- Garage doors: exterior doors located in the 'Garage' place ---------
  // These are 'Door Exterior' controls in place 'Garage', same structure as doorsExterior.
  const garageDoors = controls
    .filter(n => ctTitle(n) === 'Door Exterior' && getPlace(n) === 'Garage')
    .map(n => {
      const place = getPlace(n) ?? '';
      const lockId = doorLockStatusByPlace.get(place);
      if (!lockId) return [];
      const autoLockId = autoLockByPlace.get(place);
      return [{
        id: lockId, name: n.title, openId: toId(n),
        ...(autoLockId ? { autoLockId } : {}),
      }];
    })
    .flat()
    .sort(byName);

  // --- Cars: controls with 'Car At Home' in the title ---------------------
  const garageCars = controls
    .filter(n => /car at home/i.test(n.title))
    .map(n => ({ id: toId(n), name: n.title }))
    .sort(byName);

  // --- Device id → place map (for assembling per-place room pages) --------
  const controlPlaces: Record<string, string> = {};
  for (const n of controls) {
    const place = getPlace(n);
    if (place) controlPlaces[toId(n)] = place;
  }

  // --- Config id → state-service id map ------------------------------------
  // The aggregator service keys state by namespaced ISY id:
  //   Device:   eisy{N}/{address}     e.g. "eisy0/14 35 EB 1"
  //   Variable: eisy{N}/var/{id}      e.g. "eisy2/var/42"
  // controlIsy[0] is the EISY index (0–4); absent defaults to 0.
  const stateIdForControl = (n: (typeof controls)[0]): string | null => {
    const cf = n.controlFields;
    if (!cf) return null;
    const eisyIdx = cf.controlIsy?.[0] ?? '0';
    const ns = `eisy${eisyIdx}`;
    if (cf.controlIsyControlType === 'Device') {
      if (!cf.controlAddress) return null;
      // Insteon addresses are 3 hex bytes ("3D 13 C6") — primary nodes are sub-node 1.
      // PG3/plugin nodes use a different format (e.g. "n003_bow1") — no sub-node suffix.
      const isInsteon = /^[0-9A-F]{2}( [0-9A-F]{2}){2}$/i.test(cf.controlAddress.trim());
      return `${ns}/${cf.controlAddress}${isInsteon ? ' 1' : ''}`;
    }
    if (cf.controlIsyControlType === 'Variable') {
      return cf.controlVariableId != null ? `${ns}/var/${cf.controlVariableId}` : null;
    }
    return null;
  };
  const controlStateIds: Record<string, string> = {};
  for (const n of controls) {
    const sid = stateIdForControl(n);
    if (sid) controlStateIds[toId(n)] = sid;
  }

  // --- House Status (time-of-day) variable ----------------------------------
  // Single numeric variable (WP post 473): value 1=Morning, 2=Day, 3=Evening, 4=Night.
  const houseStatusControl = controls.find(n => n.databaseId === 473);
  const houseStatusId: string | null = houseStatusControl ? toId(houseStatusControl) : null;

  // --- House Climate variable -----------------------------------------------
  // Single numeric variable (WP post 488): value 1=Home, 2=Away, 3=Sleep.
  const houseClimateControl = controls.find(n => n.databaseId === 488);
  const houseClimateId: string | null = houseClimateControl ? toId(houseClimateControl) : null;

  // --- Weather: hub variables (current/high/low temp + conditions) ---------
  const ctrlIdByType = (title: string) => {
    const n = controls.find(c => ctTitle(c) === title);
    return n ? toId(n) : null;
  };
  // Look up by the control's own post title (for controls that share a control type).
  const ctrlIdByTitle = (title: string) => {
    const n = controls.find(c => c.title === title);
    return n ? toId(n) : null;
  };
  const weatherTempId = ctrlIdByType('Weather Variable Current Temperature');
  const weatherHighId = ctrlIdByType('Weather Variable Current High Temperature');
  const weatherLowId  = ctrlIdByType('Weather Variable Current Low Temperature');
  // Use ctrlIdByTitle — 6 controls share this control type, so ctrlIdByType is ambiguous.
  const weatherCondId = ctrlIdByTitle('Weather Current Climate Conditions');

  // --- Pool hardware controls -----------------------------------------------
  // All pool data is variable-based (PG3 Device nodes n003_* don't exist in the service yet).
  // Future: when the PG3/OmniLogic adapter is live, swap poolNodeId back to WP 626 (n003_bow1)
  // to get ph, orp, saltLevel, saltLevelAvg, heaterFiring from PoolNodeState.
  const poolNodeId           = ctrlIdByTitle('Pool Temperature');           // WP 622 — eisy0/var/173, {value: °F}
  const poolChlorinatorId    = ctrlIdByTitle('Pool Chlorinator');           // WP 274 — eisy0/var/171, {value: 1=on}
  const poolHeaterId         = ctrlIdByTitle('Pool Heater');                // WP 534 — eisy0/var/168, {value: 1=on}
  const poolPumpNodeId       = ctrlIdByTitle('Pool Pump');                  // WP 623 — eisy0/var/165, {value: 1=on}
  const poolPumpSpeedId      = ctrlIdByTitle('Pool Pump Speed');            // WP 273 — eisy0/var/166, {value: 0-100}
  const poolHeaterSetpointId = ctrlIdByTitle('Pool Heater Setpoint');       // WP 624 — eisy0/var/169, {value: °F}
  const poolHeaterFiringId   = ctrlIdByTitle('Pool Heater Firing');         // {value: 1=firing}
  const poolPhId             = ctrlIdByTitle('Pool pH');                    // {value: N, ÷10 if >14}
  const poolOrpId            = ctrlIdByTitle('Pool ORP');                   // {value: N mV}
  const poolSaltLevelId      = ctrlIdByTitle('Pool Salt Level');            // {value: N ppm}
  const poolSaltLevelAvgId   = ctrlIdByTitle('Pool Salt Level (average)'); // {value: N ppm}

  // --- Environmental controls (control_variable_environmental = true) -------
  const environmentalControls = controls
    .filter(n => n.controlFields?.controlVariableValueCopy === true)
    .map(n => ({ id: toId(n), name: n.title }));

  // --- Garage light scene: the 'Light Scene N Step' control in place 'Garage'
  const garageSceneId = sceneByPlace.get('Garage')?.id ?? null;

  // --- Garage car doors: controls of type 'Garage Car Door' (open/closed) -
  const garageCarDoors = controls
    .filter(n => ctTitle(n) === 'Garage Car Door')
    .map(n => ({ id: toId(n), name: n.title }))
    .sort(byName);

  // --- Garage: all other controls whose place is 'Garage' -----------------
  // Exterior doors and car doors get their own sections, so exclude them here.
  const GARAGE_OWN_TYPES = ['Door Exterior', 'Door Lock Status', 'Door Lock Auto Lock', 'Garage Car Door'];
  const garage = controls
    .filter(n => getPlace(n) === 'Garage' && !GARAGE_OWN_TYPES.includes(ctTitle(n)))
    .map(n => ({ id: toId(n), name: n.title }))
    .sort(byName);

  // --- Favorites catalog — light rooms + music zones + other mock groups + Scenes --------
  // One 'Lights' group — all lights flat, each tagged with place for sub-headings
  const lightFavItems = lightRooms.flatMap(r =>
    r.lights.map(l => ({ id: l.id, icon: 'bulb' as const, label: l.name, place: r.room })),
  );
  const lightsGroup = lightFavItems.length > 0
    ? [{ group: 'Lights', items: lightFavItems }]
    : [];
  // One 'Music' group — one item per speaker zone
  const musicFavItems = musicZones.map(m => ({ id: m.id, icon: 'speaker' as const, label: m.name }));
  const musicGroup = musicFavItems.length > 0
    ? [{ group: 'Music', items: musicFavItems }]
    : [];
  // One 'Fans' group — one item per fan
  const fanFavItems = fans.map(f => ({ id: f.id, icon: 'fan' as const, label: f.name }));
  const fansGroup = fanFavItems.length > 0
    ? [{ group: 'Fans', items: fanFavItems }]
    : [];
  // One 'TV' group — one item per TV
  const tvFavItems = tvs.map(t => ({ id: t.id, icon: 'tv' as const, label: t.name }));
  const tvGroup = tvFavItems.length > 0
    ? [{ group: 'TV', items: tvFavItems }]
    : [];
  // One 'Doors' group — all exterior doors
  const doorsGroup = doorsExterior.length > 0
    ? [{ group: 'Doors', items: doorsExterior.map(d => ({ id: d.id, icon: 'lock' as const, label: d.name })) }]
    : [];
  // One 'Garage Doors' group — the open/closed car doors
  const garageCarGroup = garageCarDoors.length > 0
    ? [{ group: 'Garage Doors', items: garageCarDoors.map(d => ({ id: d.id, icon: 'garage' as const, label: d.name })) }]
    : [];
  const scenesGroup = lightSceneRoomsRaw.length > 0
    ? [{ group: 'Scenes', items: lightSceneRoomsRaw.map(r => ({ id: r.id, icon: 'bulb' as const, label: r.name })) }]
    : [];
  const favCatalog = [
    ...lightsGroup, ...musicGroup, ...fansGroup, ...tvGroup,
    ...doorsGroup, ...garageCarGroup, ...scenesGroup,
  ].filter(g => g.items.length > 0);

  return {
    scenes:              [],
    sceneDefault:        [],
    sceneSchedules:      {},
    favorites:           [],
    favCatalog,
    people,
    doorsExterior,
    doorsInterior,
    climate,
    leakSensors,
    lightRooms,
    fans,
    tvs,
    musicZones,
    irrigationPrograms,
    irrigationZones,
    motionSensors,
    outdoorsPool,
    poolValves,
    outdoorsBackyard,
    whoIsHome,
    settingsSecurity,
    settingsEnvironment,
    settingsSchedules,
    settingsHouse,
    garage,
    garageDoors,
    garageCarDoors,
    garageCars,
    garageSceneId,
    controlPlaces,
    controlStateIds,
    weatherTempId:       weatherTempId       ?? null,
    weatherHighId:       weatherHighId       ?? null,
    weatherLowId:        weatherLowId        ?? null,
    weatherCondId:       weatherCondId       ?? null,
    houseStatusId:       houseStatusId       ?? null,
    houseClimateId:      houseClimateId      ?? null,
    environmentalControls,
    poolNodeId:           poolNodeId           ?? null,
    poolChlorinatorId:    poolChlorinatorId    ?? null,
    poolHeaterId:         poolHeaterId         ?? null,
    poolPumpNodeId:       poolPumpNodeId       ?? null,
    poolPumpSpeedId:      poolPumpSpeedId      ?? null,
    poolHeaterSetpointId: poolHeaterSetpointId ?? null,
    poolHeaterFiringId:   poolHeaterFiringId   ?? null,
    poolPhId:             poolPhId             ?? null,
    poolOrpId:            poolOrpId            ?? null,
    poolSaltLevelId:      poolSaltLevelId      ?? null,
    poolSaltLevelAvgId:   poolSaltLevelAvgId   ?? null,
    sceneRooms:          sceneRoomsRaw,
    lightSceneRooms:     lightSceneRoomsRaw,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the app config at build/ISR time.
 * Returns empty config (no devices shown) if WPGraphQL is unreachable or unconfigured.
 */
export async function fetchConfig(): Promise<AppConfig> {
  const endpoint = process.env.NEXT_PUBLIC_WP_GRAPHQL_URL;

  if (!endpoint) {
    console.warn('[config] NEXT_PUBLIC_WP_GRAPHQL_URL not set — returning empty config');
    return toAppConfig([]);
  }

  try {
    const nodes = await gqlAllControls<ControlNodeRaw>(HOME_CONFIG_QUERY);
    return toAppConfig(nodes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[config] WPGraphQL fetch failed (${msg}) — returning empty config`);
    return toAppConfig([]);
  }
}
