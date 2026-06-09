// =============================================================================
// Config fetcher — Home Control App
//
// fetchConfig() is called by Server Components (page.tsx) at build/ISR time.
// It tries WPGraphQL first; falls back to MOCK_CONFIG if:
//   - the env var is unset
//   - the request fails
//   - WPGraphQL hasn't been set up yet
//
// The fallback means the app is fully buildable and runnable without the
// WordPress CPT/ACF structure in place (mock-first, per CLAUDE.md).
// =============================================================================

import { gqlAllControls, HOME_CONFIG_QUERY, GraphQLError } from '@/lib/graphql';
import { MOCK_CONFIG } from '@/lib/data';
import type { AppConfig, ControlNodeRaw, SceneRoomType, SceneRoomConfig } from '@/types/config';

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

function toAppConfig(controls: ControlNodeRaw[]): AppConfig {

  // Helper: get the control-type class for a control node
  const getClass = (n: (typeof controls)[0]) =>
    n.controlFields?.controlType?.nodes[0]?.controlTypeFields?.controlTypeClass ?? null;

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

  // --- Doors (exterior locks + per-door auto-lock) ------------------------
  // Build place → autoLockId from 'Door Lock' controls
  const autoLockByPlace = new Map<string, string>();
  for (const n of controls) {
    if ((n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Door Lock') {
      const place = getPlace(n);
      if (place) autoLockByPlace.set(place, toId(n));
    }
  }
  const doorsExterior = controls
    .filter(n => (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Door Exterior')
    .map(n => {
      const place = getPlace(n) ?? '';
      const autoLockId = autoLockByPlace.get(place);
      return { id: toId(n), name: n.title, ...(autoLockId ? { autoLockId } : {}) };
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
  const tvs = controls
    .filter(n => (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'TV')
    .map(n => ({ id: toId(n), name: n.title }));

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
    .filter(n => getClass(n) === 'motion')
    .map(n => ({ id: toId(n), name: n.title }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Pool / outdoor controls -------------------------------------------
  const outdoorsPool = controls
    .filter(n => getClass(n) === 'pool')
    .map(n => ({ id: toId(n), name: n.title, kind: 'toggle' as const }));

  // --- Exterior overrides / backyard controls ----------------------------
  const outdoorsBackyard = controls
    .filter(n => getClass(n) === 'override' && EXTERIOR_PLACES.has(getPlace(n) ?? ''))
    .map(n => ({ id: toId(n), name: n.title, kind: 'toggle' as const }));

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
  // These are 'Door Exterior' controls, rendered as lock rows like the Doors page.
  const garageDoors = controls
    .filter(n => ctTitle(n) === 'Door Exterior' && getPlace(n) === 'Garage')
    .map(n => {
      const place = getPlace(n) ?? '';
      const autoLockId = autoLockByPlace.get(place);
      return { id: toId(n), name: n.title, ...(autoLockId ? { autoLockId } : {}) };
    })
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
      const ctTitle = n.controlFields?.controlType?.nodes[0]?.title ?? '';
      // FanLinc fan motor is sub-node 1; WP stores only the base address
      const address = ctTitle === 'Fan' ? `${cf.controlAddress} 1` : cf.controlAddress;
      return `${ns}/${address}`;
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

  // --- Weather: hub variables (current/high/low temp + conditions) ---------
  const ctrlIdByType = (title: string) => {
    const n = controls.find(c => ctTitle(c) === title);
    return n ? toId(n) : null;
  };
  const weatherTempId = ctrlIdByType('Weather Variable Current Temperature');
  const weatherHighId = ctrlIdByType('Weather Variable Current High Temperature');
  const weatherLowId  = ctrlIdByType('Weather Variable Current Low Temperature');
  const weatherCondId = ctrlIdByType('Weather Variable Weather Conditions');

  // --- Garage light scene: the 'Light Scene N Step' control in place 'Garage'
  const garageSceneId = sceneByPlace.get('Garage')?.id ?? null;

  // --- Garage car doors: controls of type 'Garage Car Door' (open/closed) -
  const garageCarDoors = controls
    .filter(n => ctTitle(n) === 'Garage Car Door')
    .map(n => ({ id: toId(n), name: n.title }))
    .sort(byName);

  // --- Garage: all other controls whose place is 'Garage' -----------------
  // Exterior doors and car doors get their own sections, so exclude them here.
  const GARAGE_OWN_TYPES = ['Door Exterior', 'Garage Car Door'];
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
  // Keep non-Lights, non-Music, non-Fans, non-TV, non-Scenes mock groups (Outdoor, etc.).
  // Drop the mock 'Doors' group when we have live exterior doors to replace it with.
  const HANDLED_GROUPS = ['Lights', 'Music', 'Fans', 'TV', 'Scenes'];
  const otherMockGroups = MOCK_CONFIG.favCatalog.filter(
    g => !HANDLED_GROUPS.includes(g.group)
      && !(doorsGroup.length > 0 && g.group === 'Doors')
      && !(garageCarGroup.length > 0 && g.group === 'Garage Doors'),
  );
  const favCatalog = lightFavItems.length > 0
    ? [...lightsGroup, ...musicGroup, ...fansGroup, ...tvGroup, ...doorsGroup, ...garageCarGroup, ...otherMockGroups, ...scenesGroup]
    : [
        ...MOCK_CONFIG.favCatalog.filter(
          g => g.group !== 'Scenes' && !(doorsGroup.length > 0 && g.group === 'Doors'),
        ),
        ...doorsGroup,
        ...garageCarGroup,
        ...scenesGroup,
      ];

  return {
    // Not yet in WP CPTs — use mock data
    scenes:           MOCK_CONFIG.scenes,
    sceneDefault:     MOCK_CONFIG.sceneDefault,
    sceneSchedules:   MOCK_CONFIG.sceneSchedules,
    favorites:        MOCK_CONFIG.favorites,
    favCatalog,

    // Mapped from real WP data (fall back to mock if WP returns nothing)
    people:              people.length              > 0 ? people              : MOCK_CONFIG.people,
    doorsExterior:       doorsExterior.length       > 0 ? doorsExterior       : MOCK_CONFIG.doorsExterior,
    doorsInterior:       doorsInterior.length       > 0 ? doorsInterior       : MOCK_CONFIG.doorsInterior,
    climate:             climate.length             > 0 ? climate             : MOCK_CONFIG.climate,
    leakSensors:         leakSensors.length         > 0 ? leakSensors         : MOCK_CONFIG.leakSensors,
    lightRooms:          lightRooms.length          > 0 ? lightRooms          : MOCK_CONFIG.lightRooms,
    fans:                fans.length                > 0 ? fans                : MOCK_CONFIG.fans,
    tvs:                 tvs.length                 > 0 ? tvs                 : MOCK_CONFIG.tvs,
    musicZones:          musicZones.length          > 0 ? musicZones          : MOCK_CONFIG.musicZones,
    irrigationPrograms:  irrigationPrograms.length  > 0 ? irrigationPrograms  : MOCK_CONFIG.irrigationPrograms,
    irrigationZones:     irrigationZones.length     > 0 ? irrigationZones     : MOCK_CONFIG.irrigationZones,
    motionSensors:       motionSensors.length       > 0 ? motionSensors       : MOCK_CONFIG.motionSensors,
    outdoorsPool:        outdoorsPool.length        > 0 ? outdoorsPool        : MOCK_CONFIG.outdoorsPool,
    outdoorsBackyard:    outdoorsBackyard.length    > 0 ? outdoorsBackyard    : MOCK_CONFIG.outdoorsBackyard,
    whoIsHome:           whoIsHome.length           > 0 ? whoIsHome           : MOCK_CONFIG.whoIsHome,
    settingsSecurity:    settingsSecurity.length    > 0 ? settingsSecurity    : MOCK_CONFIG.settingsSecurity,
    settingsEnvironment: settingsEnvironment.length > 0 ? settingsEnvironment : MOCK_CONFIG.settingsEnvironment,
    settingsSchedules:   settingsSchedules.length   > 0 ? settingsSchedules   : MOCK_CONFIG.settingsSchedules,
    settingsHouse:       settingsHouse.length       > 0 ? settingsHouse       : MOCK_CONFIG.settingsHouse,
    garage:              garage.length              > 0 ? garage              : MOCK_CONFIG.garage,
    garageDoors:         garageDoors.length         > 0 ? garageDoors         : MOCK_CONFIG.garageDoors,
    garageCarDoors:      garageCarDoors.length      > 0 ? garageCarDoors      : MOCK_CONFIG.garageCarDoors,
    garageCars:          garageCars.length          > 0 ? garageCars          : MOCK_CONFIG.garageCars,
    garageSceneId:       sceneRoomsRaw.length       > 0 ? garageSceneId       : MOCK_CONFIG.garageSceneId,
    controlPlaces:       Object.keys(controlPlaces).length > 0 ? controlPlaces  : MOCK_CONFIG.controlPlaces,
    controlStateIds:     Object.keys(controlStateIds).length > 0 ? controlStateIds : MOCK_CONFIG.controlStateIds,
    weatherTempId:       weatherTempId ?? MOCK_CONFIG.weatherTempId,
    weatherHighId:       weatherHighId ?? MOCK_CONFIG.weatherHighId,
    weatherLowId:        weatherLowId  ?? MOCK_CONFIG.weatherLowId,
    weatherCondId:       weatherCondId ?? MOCK_CONFIG.weatherCondId,
    houseStatusId:       houseStatusId ?? MOCK_CONFIG.houseStatusId,
    sceneRooms:          sceneRoomsRaw.length       > 0 ? sceneRoomsRaw       : MOCK_CONFIG.sceneRooms,
    lightSceneRooms:     lightSceneRoomsRaw.length  > 0 ? lightSceneRoomsRaw  : MOCK_CONFIG.lightSceneRooms,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the app config at build/ISR time.
 * Always returns a valid AppConfig — falls back to mock data on any error.
 */
export async function fetchConfig(): Promise<AppConfig> {
  const endpoint = process.env.NEXT_PUBLIC_WP_GRAPHQL_URL;

  if (!endpoint) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[config] NEXT_PUBLIC_WP_GRAPHQL_URL not set — using mock data');
    }
    return MOCK_CONFIG;
  }

  try {
    const nodes = await gqlAllControls<ControlNodeRaw>(HOME_CONFIG_QUERY);
    return toAppConfig(nodes);
  } catch (err) {
    const msg = err instanceof GraphQLError || err instanceof Error
      ? err.message
      : String(err);
    console.warn(`[config] WPGraphQL fetch failed (${msg}) — using mock data`);
    return MOCK_CONFIG;
  }
}
