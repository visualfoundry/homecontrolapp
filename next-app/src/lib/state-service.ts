// =============================================================================
// State-service proxy helpers (server-side only).
//
// The Next /api/{state,stream,command} routes are the "adapter" boundary
// between the config-plane id space (WP databaseId, used everywhere in the UI)
// and the state-plane id space (the home-control service's device ids).
//
// STATE_API_BASE_URL must be set — points to the real home-control service.
//
// ID TRANSLATION: the service keys state by the ISY id (device address or
// variable id), not the WP databaseId the UI uses. config.controlStateIds maps
// databaseId → state id; we invert it to remap incoming /state and /stream, and
// forward it to remap outgoing /command. Ids absent from the map pass through.
// =============================================================================

import { fetchConfig } from '@/lib/config';

export const STATE_API_BASE_URL = (process.env.STATE_API_BASE_URL ?? '').replace(/\/+$/, '');

interface IdMaps {
  configToState: Record<string, string>;    // databaseId → ISY id
  stateToConfig: Record<string, string[]>;  // ISY id → databaseId[] (fan-out for shared variables)
}

let mapsPromise: Promise<IdMaps> | null = null;

/** Build (once per process) the bidirectional id map from the live config. */
export function idMaps(): Promise<IdMaps> {
  if (!mapsPromise) {
    mapsPromise = fetchConfig().then((cfg) => {
      const configToState = cfg.controlStateIds ?? {};
      // Don't cache an empty map when real service is configured — WP may have been
      // temporarily unreachable; the next call will retry rather than using mock IDs forever.
      if (STATE_API_BASE_URL && Object.keys(configToState).length === 0) {
        mapsPromise = null;
      }
      const stateToConfig: Record<string, string[]> = {};
      for (const [cid, sid] of Object.entries(configToState)) (stateToConfig[sid] ??= []).push(cid);
      return { configToState, stateToConfig };
    });
  }
  return mapsPromise;
}

/** Invalidate the cached id map. Call after revalidating the 'hca-config' cache
 *  tag so that the next API request rebuilds the map from the fresh config. */
export function resetIdMaps(): void {
  mapsPromise = null;
}

/** Remap a full /state snapshot's keys from state ids → config ids. Strips `ts`.
 *  When multiple WP controls share one ISY variable, fans out to all of them. */
export async function stateToConfigIds(
  snapshot: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { ts: _ts, ...rest } = snapshot;
  const { stateToConfig } = await idMaps();
  return Object.fromEntries(
    Object.entries(rest).flatMap(([k, v]) => {
      const ids = stateToConfig[k];
      return ids ? ids.map(id => [id, v]) : [[k, v]];
    })
  );
}

/** Remap one /stream patch's id from state id → config ids (array for fan-out). */
export async function patchIdToConfigIds(stateId: string): Promise<string[]> {
  const { stateToConfig } = await idMaps();
  return stateToConfig[stateId] ?? [stateId];
}

/** Remap a /command target from config id → state id. */
export async function commandTargetToStateId(configId: string): Promise<string> {
  const { configToState } = await idMaps();
  return configToState[configId] ?? configId;
}
