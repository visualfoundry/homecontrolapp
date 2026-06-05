// =============================================================================
// Mock state store — Milestone 3
//
// In-memory implementation of the state contract (/state, /stream, /command).
// Seeded from buildInitialState(). Selected by STATE_API_BASE_URL pointing at
// the local Next.js server; swapped for the real service in Milestone 5.
//
// Shared via globalThis so the singleton survives HMR reloads in dev mode.
// The background timers emit plausible deltas so the optimistic→reconcile
// path (M4) can be exercised end-to-end before hardware is connected.
// =============================================================================

import { buildInitialState } from '@/lib/data';
import type { StateMap } from '@/types/state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An SSE chunk writer registered by an active /stream connection. */
type Writer = (chunk: string) => void;

interface MockStore {
  state: StateMap;
  writers: Set<Writer>;
  /** True once background timers have been started. */
  started: boolean;
}

// ---------------------------------------------------------------------------
// Singleton (survives Next.js HMR via globalThis)
// ---------------------------------------------------------------------------

const g = globalThis as typeof globalThis & { __hca_mock?: MockStore };

function getStore(): MockStore {
  if (!g.__hca_mock) {
    g.__hca_mock = {
      state: buildInitialState(),
      writers: new Set(),
      started: false,
    };
  }
  if (!g.__hca_mock.started) {
    g.__hca_mock.started = true;
    startTimers(g.__hca_mock);
  }
  return g.__hca_mock;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function broadcast(store: MockStore, chunk: string): void {
  store.writers.forEach((w) => {
    try {
      w(chunk);
    } catch {
      store.writers.delete(w);
    }
  });
}

/**
 * Shallow-merge patch into the in-memory state and broadcast to all
 * connected SSE clients.
 */
function emitPatch(
  store: MockStore,
  id: string,
  patch: Record<string, unknown>,
): void {
  store.state[id] = {
    ...(store.state[id] ?? {}),
    ...patch,
  } as StateMap[string];

  const data = JSON.stringify({ id, patch, ts: new Date().toISOString() });
  broadcast(store, `event: patch\ndata: ${data}\n\n`);
}

// ---------------------------------------------------------------------------
// Background timers — plausible deltas per the state contract spec
// ---------------------------------------------------------------------------

// Light ids that are on in the seed state — good candidates to dim/brighten
const LIVE_LIGHT_IDS = [
  'lr-main', 'lr-art', 'lr-chand', 'lr-sun', 'lr-table',
  'sw-lamp', 'sw-main',
];

// Motion sensor ids from the seed (motion: true at indices 17 and 24)
const MOTION_IDS = ['mo-17', 'mo-24'];

function startTimers(store: MockStore): void {
  // ── Heartbeat ──────────────────────────────────────────────────────────
  // SSE spec: comment lines keep the connection alive through proxies.
  setInterval(() => {
    broadcast(store, ': heartbeat\n\n');
  }, 25_000);

  // ── Plausible device deltas ─────────────────────────────────────────────
  // Fired every 7 seconds; each tick picks one category at random so the
  // stream stays lively but not noisy.
  setInterval(() => {
    const roll = Math.random();

    if (roll < 0.35) {
      // Dimmer drift — a lit light's level drifts ±3–8 points
      const id = LIVE_LIGHT_IDS[Math.floor(Math.random() * LIVE_LIGHT_IDS.length)];
      const cur = store.state[id] as { on: boolean; level: number } | undefined;
      if (cur?.on && cur.level > 0) {
        const drift = Math.round(Math.random() * 10 - 5);
        const level = Math.max(10, Math.min(100, cur.level + drift));
        emitPatch(store, id, { level });
      }
    } else if (roll < 0.55) {
      // Motion sensor toggle
      const id = MOTION_IDS[Math.floor(Math.random() * MOTION_IDS.length)];
      const cur = store.state[id] as { motion: boolean } | undefined;
      emitPatch(store, id, { motion: !(cur?.motion ?? false) });
    } else if (roll < 0.75) {
      // Pool temp wiggle (±0.5 °F, bounded ±2 of seed 81 °F)
      const cur = store.state['pool'] as { poolTemp?: number } | undefined;
      const base = cur?.poolTemp ?? 81;
      const next = Math.max(79, Math.min(83, base + (Math.random() - 0.5)));
      emitPatch(store, 'pool', { poolTemp: Math.round(next * 10) / 10 });
    } else {
      // Thermostat measured-temp drift on cl-1 (±0.5 °F, bounded 70–74)
      const cur = store.state['cl-1'] as { temp?: number } | undefined;
      const base = cur?.temp ?? 71.5;
      const next = Math.max(70, Math.min(74, base + (Math.random() * 0.5 - 0.25)));
      emitPatch(store, 'cl-1', { temp: Math.round(next * 10) / 10 });
    }
  }, 7_000);
}

// ---------------------------------------------------------------------------
// Public API (consumed by the three route handlers)
// ---------------------------------------------------------------------------

/** Return the full in-memory state map (for GET /state). */
export function getMockState(): StateMap {
  return getStore().state;
}

/**
 * Handle a POST /command body.
 * - `action:"activate"` — scene trigger, no state change in the mock.
 * - `action:"run"` — irrigation zone run, echo back an on→off cycle.
 * - `patch` present — shallow-merge after a 200 ms delay (simulates hub roundtrip)
 *   so the optimistic→reconcile path can be exercised in M4.
 */
export function applyCommand(
  target: string,
  patch?: Record<string, unknown>,
  action?: string,
): void {
  if (action === 'activate') return; // scene trigger — no state to echo back
  if (action === 'run') {
    // Emit on, then off after 3 s
    const store = getStore();
    setTimeout(() => emitPatch(store, target, { on: true }), 200);
    setTimeout(() => emitPatch(store, target, { on: false }), 3_200);
    return;
  }
  if (patch && Object.keys(patch).length > 0) {
    const store = getStore();
    setTimeout(() => emitPatch(store, target, patch), 200);
  }
}

/**
 * Register an SSE writer for an active /stream connection.
 * Returns an unsubscribe function to call on disconnect.
 */
export function subscribe(writer: Writer): () => void {
  const store = getStore();
  store.writers.add(writer);
  return () => store.writers.delete(writer);
}
