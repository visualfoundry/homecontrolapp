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

function loadPrefs(): UserPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) } as UserPrefs;
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

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function HCProvider({ children, config }: { children: React.ReactNode; config: AppConfig }) {
  const [st, setSt] = useState<StateMap>(() => {
    // Seed from full catalog; override prefs-like keys from live config.
    const seed = buildInitialState();
    seed['_favs']   = { ids: [...config.favorites] };
    seed['_scenes'] = { ids: [...config.sceneDefault] };
    return seed;
  });
  const [stack, setStack] = useState<string[]>(['home']);
  // Initialize with DEFAULT_PREFS so server and client render identically.
  // Hydrate from localStorage after mount to avoid SSR/client mismatch.
  const [prefs, setPrefsState] = useState<UserPrefs>(DEFAULT_PREFS);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Load saved prefs after hydration (must not run on server)
  useEffect(() => { setPrefsState(loadPrefs()); }, []);

  // Persist prefs whenever they change (skip the initial DEFAULT_PREFS render)
  useEffect(() => { savePrefs(prefs); }, [prefs]);

  // Apply theme attribute to #hca-root whenever theme pref changes
  useEffect(() => {
    const root = document.getElementById('hca-root');
    if (root) root.setAttribute('data-theme', prefs.theme);
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
        setSt((prev) => ({
          // Keep user-owned keys intact, overwrite device-control keys from server.
          '_favs':   prev['_favs'],
          '_scenes': prev['_scenes'],
          '_global': prev['_global'],
          ...live,
        }));
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
    const isDeviceControl =
      !id.startsWith('_') &&
      !id.startsWith('person:') &&
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
    setPrefsState((prev) => ({ ...prev, ...patch }));
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
