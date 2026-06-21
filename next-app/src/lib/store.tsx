'use client';

// =============================================================================
// App store — Home Control App
//
// Provides:
//   HCtx         — React context
//   useHC()      — hook to consume the context
//   HCProvider   — wraps the app; holds device state, nav, and user prefs
//
// Device state (st / setD):
//   Flat map keyed by device id, mutated by shallow-merged patches.
//   Seeded from real config (scene rooms, light scenes, fans) for instant render,
//   then replaced by GET /state on mount. SSE /stream patches keep it live.
//   setD is optimistic (also POSTs to /command); /stream is authoritative.
//
// User prefs (prefs / setPrefs):
//   theme, accent, radius, density, font, tabs → persisted to localStorage.
//   Separate from device state — never routed through the home-control service.
//
// Nav (go / back / stack):
//   Tab slots reset the nav stack; secondary screens push onto it.
// =============================================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { SECTIONS, MAX_TABS, isTabSlot } from '@/lib/sections';
import type { SectionDef } from '@/lib/sections';
import type { StateMap, StatePatch } from '@/types/state';
import { type UserPrefs, DEFAULT_PREFS, type AppConfig, type NotificationPrefs, DEFAULT_NOTIF_PREFS } from '@/types/config';
import { fetchState, postCommand, connectSSE } from '@/lib/state-client';

// ---------------------------------------------------------------------------
// Context value shape
// ---------------------------------------------------------------------------

export interface HCContextValue {
  /** Flat device state map. */
  st: StateMap;
  /** Shallow-merge a patch into one device's state. */
  setD: (id: string, patch: StatePatch) => void;
  /** Navigate to a screen. Tab slots reset the stack; others push. */
  go: (id: string) => void;
  /** Pop the nav stack. */
  back: () => void;
  /** Current nav stack. Last item is the visible screen. */
  stack: string[];
  /** User preferences (theme, tabs, accent, …). */
  prefs: UserPrefs;
  /** Update one or more user preferences (persisted to localStorage). */
  setPrefs: (patch: Partial<UserPrefs>) => void;
  /** Section registry. */
  sections: Record<string, SectionDef>;
  /** Max number of user-chosen tab slots. */
  maxTabs: typeof MAX_TABS;
  /** Ref to the overlay host div (portal target for bottom sheets). */
  overlayRef: React.RefObject<HTMLDivElement>;
  /** App catalog config (devices, scenes, rooms, etc.). */
  config: AppConfig;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const HCtx = createContext<HCContextValue | null>(null);

export function useHC(): HCContextValue {
  const ctx = useContext(HCtx);
  if (!ctx) throw new Error('useHC must be used inside HCProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Prefs — localStorage persistence
// ---------------------------------------------------------------------------

const PREFS_KEY   = 'hca:prefs';
const FAVS_KEY    = 'hca:favs';
const SCENES_KEY  = 'hca:scenes';

function loadPrefs(): UserPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const saved = { ...DEFAULT_PREFS, ...JSON.parse(raw) } as UserPrefs;
    // Ensure Home is always first — guard against old saved prefs that predate this rule
    if (!saved.tabs.includes('home')) saved.tabs = ['home', ...saved.tabs];
    else if (saved.tabs[0] !== 'home') saved.tabs = ['home', ...saved.tabs.filter(t => t !== 'home')];
    return saved;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: UserPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage quota exceeded — ignore
  }
}

function loadFavs(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FAVS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

const NOTIF_KEY = 'hca:notifications';

export function loadNotifPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return DEFAULT_NOTIF_PREFS;
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (!raw) return DEFAULT_NOTIF_PREFS;
    return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIF_PREFS;
  }
}

export function saveNotifPrefs(prefs: NotificationPrefs): void {
  try {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
  } catch {
    // storage quota exceeded — ignore
  }
}

function saveFavs(ids: string[]): void {
  try {
    localStorage.setItem(FAVS_KEY, JSON.stringify(ids));
  } catch {
    // storage quota exceeded — ignore
  }
}

function loadScenes(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SCENES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function saveScenes(ids: string[]): void {
  try {
    localStorage.setItem(SCENES_KEY, JSON.stringify(ids));
  } catch {
    // storage quota exceeded — ignore
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function HCProvider({ children, config }: { children: React.ReactNode; config: AppConfig }) {
  const [st, setSt] = useState<StateMap>(() => {
    const seed: StateMap = {};
    const savedFavs = loadFavs();
    seed['_favs']   = { ids: savedFavs ?? [...config.favorites] };
    const savedScenes = loadScenes();
    seed['_scenes'] = { ids: savedScenes ?? [...config.sceneDefault] };
    seed['_global'] = { timeOfDay: 'Morning', weather: 'Clear' };
    for (const r of config.sceneRooms) {
      seed[`auto:${r.id}`] = {
        automated: true, motion: false, doorOpen: false,
        manual: false, nightDim: false, intensity: 50,
      };
      if (r.steps) seed[r.id] = { value: 0 };
    }
    for (const r of config.lightSceneRooms) seed[r.id] = { on: false };
    for (const f of config.fans) seed[f.id] = { on: false, speed: 0 };
    for (const o of config.outdoorsPool) seed[o.id] = { on: false };
    for (const v of config.poolValves) seed[v.id] = { value: 0 };
    for (const o of config.outdoorsBackyard) seed[o.id] = { on: false };
    seed['pool'] = {
      pumpOn: false, pumpSpeed: 65,
      heaterOn: false, heaterRunning: false,
      poolTemp: 0, heaterTarget: 82,
      ph: 7.4, phTarget: 7.4,
      chlorinatorOn: false, orpSet: 700, orpNow: 650,
      saltPPM: 3200,
      pumpSchedules: [], heaterSchedules: [],
    };
    return seed;
  });
  // Grace period map: device id → timestamp after which SSE patches are accepted again.
  // Prevents stale poll values from overwriting optimistic updates mid-flight.
  const pendingUntil = useRef<Map<string, number>>(new Map());

  const [stack, setStack] = useState<string[]>(['home']);
  // Initialize with DEFAULT_PREFS so server and client render identically.
  // Hydrate from localStorage after mount to avoid SSR/client mismatch.
  const [prefs, setPrefsState] = useState<UserPrefs>(DEFAULT_PREFS);
  const overlayRef = useRef<HTMLDivElement>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced server sync — reads from localStorage (always up-to-date by call time).
  const schedulePrefsSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      const savedPrefs = loadPrefs();
      const savedFavs = loadFavs() ?? [];
      const savedScenes = loadScenes() ?? [];
      fetch('/api/prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs: savedPrefs, favs: savedFavs, scenes: savedScenes }),
      }).catch(() => {});
    }, 1500);
  }, []);

  // Load saved prefs after hydration (must not run on server)
  useEffect(() => { setPrefsState(loadPrefs()); }, []);

  // Hydrate from server after mount — server wins over localStorage for cross-device sync
  useEffect(() => {
    fetch('/api/prefs')
      .then(r => r.ok ? r.json() : null)
      .then((data: { prefs?: Partial<UserPrefs>; favs?: string[]; scenes?: string[] } | null) => {
        if (!data) return;
        if (data.prefs && typeof data.prefs === 'object') {
          const merged = { ...DEFAULT_PREFS, ...data.prefs } as UserPrefs;
          if (!merged.tabs.includes('home')) merged.tabs = ['home', ...merged.tabs];
          else if (merged.tabs[0] !== 'home') merged.tabs = ['home', ...merged.tabs.filter(t => t !== 'home')];
          setPrefsState(merged);
          savePrefs(merged);
        }
        if (Array.isArray(data.favs)) {
          const favIds = data.favs as string[];
          setSt(prev => ({ ...prev, _favs: { ids: favIds } } as StateMap));
          saveFavs(favIds);
        }
        if (Array.isArray(data.scenes)) {
          const sceneIds = data.scenes as string[];
          setSt(prev => ({ ...prev, _scenes: { ids: sceneIds } } as StateMap));
          saveScenes(sceneIds);
        }
      })
      .catch(() => {});
  }, []);

  // Apply theme attribute to #hca-root whenever theme pref changes.
  // 'system' follows the OS preference and re-applies when it changes.
  useEffect(() => {
    const root = document.getElementById('hca-root');
    if (!root) return;
    if (prefs.theme !== 'system') {
      root.setAttribute('data-theme', prefs.theme);
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => root.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [prefs.theme]);

  // Apply dynamic CSS vars for user-tunable tokens
  useEffect(() => {
    const root = document.getElementById('hca-root');
    if (!root) return;
    root.style.setProperty('--accent', prefs.accent);
    root.style.setProperty('--radius', `${prefs.radius}px`);
    const pad = { compact: 13, regular: 16, comfy: 20 }[prefs.density];
    root.style.setProperty('--card-pad', `${pad}px`);
    const font =
      prefs.font === 'rounded'
        ? 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif'
        : '-apple-system, system-ui, "Segoe UI", sans-serif';
    root.style.setProperty('--font', font);
  }, [prefs.accent, prefs.radius, prefs.density, prefs.font]);

  // ── SSE connection + /state re-seed on mount / reconnect ──────────────────
  useEffect(() => {
    let alive = true;

    // Seed from /state on mount (replaces config-seeded defaults after first render).
    function reseed() {
      fetchState().then((live) => {
        if (!alive) return;
        setSt((prev) => {
          // Preserve user-owned and automation keys; overwrite device-control keys from server.
          // auto:* keys are not managed by the device service (see setD comment below).
          const preserved: StateMap = {
            '_favs':   prev['_favs'],
            '_scenes': prev['_scenes'],
            '_global': prev['_global'],
          };
          for (const [k, v] of Object.entries(prev)) {
            if (k.startsWith('auto:')) preserved[k] = v;
          }
          // Light scene room IDs are plain WP numbers not in the mock service —
          // preserve them so favoured scene tiles survive reseeds.
          for (const r of config.lightSceneRooms) {
            if (r.id in prev && !(r.id in live)) preserved[r.id] = prev[r.id];
          }
          // Fan IDs: preserve current state (optimistic or live) when the
          // service snapshot doesn't include them (ID not yet mapped in WP).
          for (const f of config.fans) {
            if (f.id in prev && !(f.id in live)) preserved[f.id] = prev[f.id];
          }
          // Scene room step variables: preserve when not in live snapshot.
          for (const r of config.sceneRooms) {
            if (r.steps && r.id in prev && !(r.id in live)) preserved[r.id] = prev[r.id];
          }
          // Outdoor pool toggle IDs (270, 271, 272 / eisy4/var/*): preserve when
          // absent from live snapshot — eisy4 variables can be missing from a
          // snapshot if the EISY 4 poll hasn't completed yet, which would drop
          // the tiles from the DOM entirely since the tile guards with `if (!s)`.
          for (const o of config.outdoorsPool) {
            if (o.id in prev && !(o.id in live)) preserved[o.id] = prev[o.id];
          }
          // Pool hardware variable IDs: preserve so readings don't revert to
          // seed/default when a reseed races the state snapshot.
          for (const id of [
            config.poolNodeId, config.poolPumpNodeId, config.poolPumpSpeedId,
            config.poolHeaterId, config.poolHeaterSetpointId, config.poolChlorinatorId,
            config.poolHeaterFiringId, config.poolPhId, config.poolOrpId,
            config.poolSaltLevelId, config.poolSaltLevelAvgId,
          ]) {
            if (id && id in prev && !(id in live)) preserved[id] = prev[id];
          }
          // Strip user-owned keys from live state — they must never overwrite preserved values.
          const deviceState = Object.fromEntries(
            Object.entries(live).filter(([k]) => !k.startsWith('_') && !k.startsWith('auto:')),
          );
          // Pool state is managed by OmniLogic (not the ISY state service).
          // Always carry forward from prev — placed AFTER deviceState so it wins the spread.
          const poolState = prev['pool'];
          return { ...preserved, ...deviceState, ...(poolState ? { pool: poolState } : {}) };
        });
      }).catch(() => {
        // Service unreachable — keep using seed state.
      });
    }

    reseed();

    const cleanup = connectSSE(
      // onPatch — apply incoming deltas, skipping devices with a pending command
      // to avoid the optimistic-update flicker caused by a stale poll arriving
      // before EISY has processed the command.
      (id, patch) => {
        const expiry = pendingUntil.current.get(id);
        if (expiry) {
          if (Date.now() < expiry) return;
          pendingUntil.current.delete(id);
        }
        setSt((prev) => ({
          ...prev,
          [id]: { ...(prev[id] ?? {}), ...patch } as StateMap[string],
        }));
      },
      // onReseed — called by connectSSE before it reconnects
      reseed,
    );

    return () => {
      alive = false;
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  /**
   * Optimistically apply a patch to local state and POST it to /command
   * for device-control keys (everything except _*, person:*, auto:* which
   * are user-prefs / presence / automation — not routed through the service).
   */
  const setD = useCallback((id: string, patch: StatePatch) => {
    setSt((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), ...patch } as StateMap[string],
    }));
    if (id === '_favs' && 'ids' in patch) {
      saveFavs(patch.ids as string[]);
      schedulePrefsSync();
    }
    if (id === '_scenes' && 'ids' in patch) {
      saveScenes(patch.ids as string[]);
      schedulePrefsSync();
    }
    const isDeviceControl =
      !id.startsWith('_') &&
      !id.startsWith('auto:');
    if (isDeviceControl) {
      postCommand(id, patch as Record<string, unknown>);
      // Suppress stale SSE patches for this device for 3 s — long enough to
      // cover 2–3 poll cycles while EISY processes the command.
      pendingUntil.current.set(id, Date.now() + 3_000);
    }
  }, [schedulePrefsSync]);

  const go = useCallback(
    (id: string) => {
      setStack((prev) => {
        if (prev[prev.length - 1] === id) return prev;
        if (isTabSlot(id, prefs.tabs)) return [id];
        return [...prev, id];
      });
    },
    [prefs.tabs],
  );

  const back = useCallback(
    () => setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)),
    [],
  );

  const setPrefs = useCallback((patch: Partial<UserPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      schedulePrefsSync();
      return next;
    });
  }, [schedulePrefsSync]);

  const value: HCContextValue = {
    st,
    setD,
    go,
    back,
    stack,
    prefs,
    setPrefs,
    sections: SECTIONS,
    maxTabs: MAX_TABS,
    overlayRef,
    config,
  };

  return <HCtx.Provider value={value}>{children}</HCtx.Provider>;
}
