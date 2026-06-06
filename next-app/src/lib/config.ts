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
    'Motion Sensor', 'Override Switch', 'Auto Switch', 'Door Interior', 'Door Switch LED',
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
    if (place) {
      const byType = controlsByPlaceType.get(place) ?? new Map();
      const motionId   = byType.get('Motion Sensor');
      const switchId   = byType.get('Override Switch');
      const autoId     = byType.get('Auto Switch');
      const doorId     = byType.get('Door Interior');
      const nightDimId = byType.get('Door Switch LED');
      if (motionId)   room.motionId   = motionId;
      if (switchId)   room.switchId   = switchId;
      if (autoId)     room.autoId     = autoId;
      if (doorId)     room.doorId     = doorId;
      if (nightDimId) room.nightDimId = nightDimId;
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
    .map(n => ({ id: toId(n), name: n.title }));

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

  // --- Who's Home: controls with control-type title 'Security' ------------
  const whoIsHome = controls
    .filter(n => (n.controlFields?.controlType?.nodes[0]?.title ?? '') === 'Security')
    .map(n => ({ id: toId(n), name: n.title }));

  // --- People (presence): control type 'Geolocation <Name>' ---------------
  // e.g. control type title "Geolocation Alex" → person name "Alex"
  const people = controls
    .filter(n => /^Geolocation\s+\S/i.test(n.controlFields?.controlType?.nodes[0]?.title ?? ''))
    .map(n => ({
      id: toId(n),
      name: (n.controlFields?.controlType?.nodes[0]?.title ?? '').replace(/^Geolocation\s+/i, '').trim(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Settings: security vs environment ---------------------------------
  const settingControls = controls.filter(n => getClass(n) === 'setting');
  const SECURITY_KEYWORDS = /security|car at home|alarm/i;
  const SCHEDULE_KEYWORDS = /schedule|irrigation/i;
  const settingsSecurity = settingControls
    .filter(n => SECURITY_KEYWORDS.test(n.title))
    .map(n => ({ id: toId(n), name: n.title }));
  const settingsSchedules = settingControls
    .filter(n => SCHEDULE_KEYWORDS.test(n.title))
    .map(n => ({ id: toId(n), name: n.title }));
  const settingsEnvironment = [
    ...settingControls.filter(
      n => !SECURITY_KEYWORDS.test(n.title) && !SCHEDULE_KEYWORDS.test(n.title),
    ),
    ...controls.filter(n => ['theatre-screen', 'house-status'].includes(getClass(n) ?? '')),
  ].map(n => ({ id: toId(n), name: n.title }));

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
  const scenesGroup = lightSceneRoomsRaw.length > 0
    ? [{ group: 'Scenes', items: lightSceneRoomsRaw.map(r => ({ id: r.id, icon: 'bulb' as const, label: r.name })) }]
    : [];
  // Keep non-Lights, non-Music, non-Fans, non-TV, non-Scenes mock groups (Doors, Outdoor, etc.)
  const otherMockGroups = MOCK_CONFIG.favCatalog.filter(
    g => g.group !== 'Lights' && g.group !== 'Music' && g.group !== 'Fans' && g.group !== 'TV' && g.group !== 'Scenes',
  );
  const favCatalog = lightFavItems.length > 0
    ? [...lightsGroup, ...musicGroup, ...fansGroup, ...tvGroup, ...otherMockGroups, ...scenesGroup]
    : [...MOCK_CONFIG.favCatalog.filter(g => g.group !== 'Scenes'), ...scenesGroup];

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
