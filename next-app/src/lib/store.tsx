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
//   Seeded from buildInitialState() for instant render, then replaced by
//   GET /state on mount. SSE /stream patches keep it live. setD is
//   optimistic (also POSTs to /command); /stream is authoritative.
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
import { type UserPrefs, DEFAULT_PREFS, type AppConfig } from '@/types/config';
import { buildInitialState } from '@/lib/data';
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

const PREFS_KEY = 'hca:prefs';
const FAVS_KEY  = 'hca:favs';

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

function saveFavs(ids: string[]): void {
  try {
    localStorage.setItem(FAVS_KEY, JSON.stringify(ids));
  } catch {
    // storage quota exceeded — ignore
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function HCProvider({ children, config }: { children: React.ReactNode; config: AppConfig }) {
  const [st, setSt] = useState<StateMap>(() => {
    // Seed from full catalog; override prefs-like keys from live config.
    const seed = buildInitialState();
    const savedFavs = loadFavs(); // null on server (window undefined), real value on client
    seed['_favs']   = { ids: savedFavs ?? [...config.favorites] };
    seed['_scenes'] = { ids: [...config.sceneDefault] };
    // Seed automation state for every scene room from the real config.
    // buildInitialState() uses mock IDs; config.sceneRooms may have WP IDs.
    for (const r of config.sceneRooms) {
      if (!(`auto:${r.id}` in seed)) {
        seed[`auto:${r.id}`] = {
          automated: true, motion: false, doorOpen: false,
          manual: false, nightDim: false, intensity: 50,
        };
      }
    }
    // Seed device state for light scene rooms so FavTile can render them.
    // Real state comes from the service once connected; this is the pre-connect default.
    for (const r of config.lightSceneRooms) {
      if (!(r.id in seed)) {
        seed[r.id] = { on: false };
      }
    }
    // Seed fan state so FanCard has a defined starting value before /state arrives.
    for (const f of config.fans) {
      if (!(f.id in seed)) {
        seed[f.id] = { on: false, speed: 0 };
      }
    }
    // Seed scene room step variables (room.id = Light Scene N Step control).
    for (const r of config.sceneRooms) {
      if (r.steps && !(r.id in seed)) {
        seed[r.id] = { value: 0 };
      }
    }
    return seed;
  });
  const [stack, setStack] = useState<string[]>(['home']);
  // Initialize with DEFAULT_PREFS so server and client render identically.
  // Hydrate from localStorage after mount to avoid SSR/client mismatch.
  const [prefs, setPrefsState] = useState<UserPrefs>(DEFAULT_PREFS);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Load saved prefs after hydration (must not run on server)
  useEffect(() => { setPrefsState(loadPrefs()); }, []);

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

    // Seed from /state on mount (replaces buildInitialState seed after first render).
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
          // Strip user-owned keys from live state — they must never overwrite preserved values.
          const deviceState = Object.fromEntries(
            Object.entries(live).filter(([k]) => !k.startsWith('_') && !k.startsWith('auto:')),
          );
          return { ...preserved, ...deviceState };
        });
      }).catch(() => {
        // Service unreachable — keep using seed state.
      });
    }

    reseed();

    const cleanup = connectSSE(
      // onPatch — apply incoming deltas directly (authoritative)
      (id, patch) => {
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
    }
    const isDeviceControl =
      !id.startsWith('_') &&
      !id.startsWith('auto:');
    if (isDeviceControl) {
      postCommand(id, patch as Record<string, unknown>);
    }
  }, []);

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
      return next;
    });
  }, []);

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
