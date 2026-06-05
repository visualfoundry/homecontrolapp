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

import { gql, HOME_CONFIG_QUERY, GraphQLError } from '@/lib/graphql';
import { MOCK_CONFIG } from '@/lib/data';
import type { AppConfig, HomeConfigRaw } from '@/types/config';

// ---------------------------------------------------------------------------
// Transform WPGraphQL response → AppConfig
// ---------------------------------------------------------------------------

function toAppConfig(raw: HomeConfigRaw): AppConfig {
  const scenes     = raw.scenes.nodes;
  const sceneRooms = raw.sceneRooms.nodes;
  const people     = raw.people.nodes;
  const rooms      = raw.rooms.nodes;

  // Extract unique scene ids from WP layout or fall back to first 5 scenes
  const sceneDefault =
    raw.layout.dashboardSceneIds.length > 0
      ? raw.layout.dashboardSceneIds
      : scenes.slice(0, 5).map(s => s.id);

  const favorites =
    raw.layout.dashboardFavIds.length > 0
      ? raw.layout.dashboardFavIds
      : MOCK_CONFIG.favorites;

  // Build lightRooms from room nodes whose devices are class 'light'.
  const lightRooms = rooms
    .filter(r => r.devices.nodes.some(d => d.class === 'light'))
    .map(r => ({
      room: r.name,
      lights: r.devices.nodes
        .filter(d => d.class === 'light')
        .sort((a, b) => a.order - b.order)
        .map(d => ({ id: d.id, name: d.name })),
    }));

  // For device types not yet modeled in WP CPTs, fall back to mock data.
  // Each of these will be replaced once the CPTs are fully configured.
  return {
    scenes,
    sceneDefault,
    people,
    lightRooms: lightRooms.length > 0 ? lightRooms : MOCK_CONFIG.lightRooms,
    doorsExterior:       MOCK_CONFIG.doorsExterior,
    doorsInterior:       MOCK_CONFIG.doorsInterior,
    climate:             MOCK_CONFIG.climate,
    musicZones:          MOCK_CONFIG.musicZones,
    fans:                MOCK_CONFIG.fans,
    irrigationPrograms:  MOCK_CONFIG.irrigationPrograms,
    irrigationZones:     MOCK_CONFIG.irrigationZones,
    leakSensors:         MOCK_CONFIG.leakSensors,
    motionSensors:       MOCK_CONFIG.motionSensors,
    outdoorsPool:        MOCK_CONFIG.outdoorsPool,
    outdoorsBackyard:    MOCK_CONFIG.outdoorsBackyard,
    settingsSecurity:    MOCK_CONFIG.settingsSecurity,
    settingsEnvironment: MOCK_CONFIG.settingsEnvironment,
    settingsSchedules:   MOCK_CONFIG.settingsSchedules,
    sceneRooms:          sceneRooms.length > 0 ? sceneRooms : MOCK_CONFIG.sceneRooms,
    sceneSchedules:      MOCK_CONFIG.sceneSchedules,
    favorites,
    favCatalog: raw.favCatalog.groups.length > 0
      ? raw.favCatalog.groups
      : MOCK_CONFIG.favCatalog,
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
    const raw = await gql<HomeConfigRaw>(HOME_CONFIG_QUERY);
    return toAppConfig(raw);
  } catch (err) {
    const msg = err instanceof GraphQLError || err instanceof Error
      ? err.message
      : String(err);
    console.warn(`[config] WPGraphQL fetch failed (${msg}) — using mock data`);
    return MOCK_CONFIG;
  }
}
