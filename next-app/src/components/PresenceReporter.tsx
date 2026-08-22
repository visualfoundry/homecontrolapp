'use client';

// =============================================================================
// PresenceReporter — the app reporting its own position
//
// On for everyone: there is no app-level switch, because the browser's location
// permission already is one, and a second switch on top of it only adds a way
// for presence to be quietly off.
//
// Two rules this file exists to enforce:
//
// ASK ONCE. The OS prompt is shown at most once per install. Safari cannot be
// asked what the current geolocation permission is — permissions.query() throws
// for it — so a reporter that reads the position whenever it can't tell re-opens
// that prompt on every resume, which is how people learn to tap Deny. The answer
// is remembered here instead, and an unresolved permission is read exactly once.
// Only a deliberate tap in Settings asks again.
//
// STAY LIVE. While the app is open a position watch runs, so walking out of the
// fence flips presence there and then rather than at the next reload. iOS never
// wakes a web app to check a geofence, so arrival and departure while the app is
// closed stay the job of the phone's own automation calling the presence link.
// Both write the same variable.
// =============================================================================

import { useEffect } from 'react';

export type Permissionish = 'granted' | 'denied' | 'prompt' | 'unknown';

// ---------------------------------------------------------------------------
// Remembered permission
//
// What the browser told us last time, so Safari's missing permissions.query()
// doesn't turn "we already asked" into "ask again".
// ---------------------------------------------------------------------------

const MEMO_KEY = 'hca:geo-permission';

interface Memo {
  /** The OS prompt has been opened at least once. */
  asked?: boolean;
  /** A position was read successfully. */
  granted?: boolean;
  /** The read came back PERMISSION_DENIED. */
  denied?: boolean;
}

function readMemo(): Memo {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(MEMO_KEY) ?? '{}') as Memo;
  } catch {
    return {};
  }
}

function writeMemo(patch: Memo): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MEMO_KEY, JSON.stringify({ ...readMemo(), ...patch }));
  } catch {
    // Private mode / quota — we lose ask-once across reloads, nothing else.
  }
}

/** What the browser currently thinks, without asking the user anything. */
export async function locationPermission(): Promise<Permissionish> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'denied';
  if (navigator.permissions) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      const state = status.state as Permissionish;
      // Keep the memo in step with the authoritative answer where there is one.
      if (state === 'granted') writeMemo({ granted: true, denied: false, asked: true });
      if (state === 'denied') writeMemo({ granted: false, denied: true, asked: true });
      return state;
    } catch {
      // Safari has never supported querying geolocation this way — fall through
      // to what we remember.
    }
  }
  const memo = readMemo();
  if (memo.denied) return 'denied';
  if (memo.granted) return 'granted';
  return memo.asked ? 'unknown' : 'prompt';
}

/**
 * Read the position, recording what the attempt revealed about permission.
 *
 * Every read can open the OS prompt, so this is also where `asked` is set: the
 * gate below reads that flag to make sure the prompt is opened once and not once
 * per resume.
 */
export async function readPosition(highAccuracy = false): Promise<GeolocationPosition | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  writeMemo({ asked: true });
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      p => { writeMemo({ granted: true, denied: false }); resolve(p); },
      err => { noteGeoError(err); resolve(null); },
      { enableHighAccuracy: highAccuracy, timeout: 10_000, maximumAge: 120_000 },
    );
  });
}

/** Back-compat name — Settings reads a position directly to set the home point. */
export const currentPosition = readPosition;

/** Record a denial; leave the memo alone for a fix that merely failed to arrive. */
function noteGeoError(err: GeolocationPositionError): void {
  if (err.code === err.PERMISSION_DENIED) writeMemo({ granted: false, denied: true });
}

/**
 * May we read the position right now?
 *
 * `explicit` is a deliberate tap in Settings, which is allowed to re-open a
 * prompt we would otherwise leave alone — including after a denial, where the
 * browser will either re-ask or refuse silently. That is the user's call.
 */
async function mayRead(explicit: boolean): Promise<boolean> {
  const state = await locationPermission();
  if (state === 'granted') return true;
  if (state === 'denied') return explicit;
  // 'prompt' | 'unknown' — unresolved, so reading opens the OS sheet. Once.
  return explicit || !readMemo().asked;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface ReportResult {
  ok: boolean;
  person?: string;
  home?: boolean;
  distance?: number;
  /** The fix was too coarse to judge — presence was left as it was. */
  unchanged?: boolean;
  /** Metres of uncertainty in the reported fix, echoed back with `unchanged`. */
  accuracy?: number;
  error?: string;
}

/** Send one position to the server and return what it made of it. */
export async function postPosition(position: GeolocationPosition): Promise<ReportResult> {
  try {
    const res = await fetch('/api/presence/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        // How far the fix could be off. The server needs it to tell "outside the
        // fence" from "somewhere in a one-kilometre circle that includes home".
        accuracy: position.coords.accuracy,
      }),
    });
    const data = await res.json().catch(() => ({})) as ReportResult;
    return res.ok ? { ...data, ok: true } : { ok: false, error: data.error ?? `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: 'Could not reach the app server' };
  }
}

/** Read the position and report it. Used by the Settings tap; ungated on purpose. */
export async function reportLocation(): Promise<ReportResult> {
  const position = await readPosition();
  if (!position) return { ok: false, error: 'Location unavailable' };
  return postPosition(position);
}

// ---------------------------------------------------------------------------
// The watch
// ---------------------------------------------------------------------------

/** Don't post more often than this unless the phone actually moved. */
const REPORT_MIN_MS = 4 * 60 * 1000;
/** Movement since the last post that earns a new one regardless of the clock. */
const MOVED_M = 40;
/** Safety net: some browsers fire a watch once and go quiet. */
const HEARTBEAT_MS = 5 * 60 * 1000;

/** Metres between two points (haversine). */
function metres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function PresenceReporter() {
  useEffect(() => {
    let cancelled = false;
    let watchId: number | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let posting = false;
    let lastAt = 0;
    let lastPoint: { lat: number; lng: number } | null = null;

    /** A fix worth the round trip: the first one, one far enough from the last
     *  to matter, or one old enough that the server's view has gone stale. */
    const worthPosting = (p: GeolocationPosition): boolean => {
      if (!lastPoint) return true;
      if (Date.now() - lastAt >= REPORT_MIN_MS) return true;
      return metres(lastPoint, { lat: p.coords.latitude, lng: p.coords.longitude }) >= MOVED_M;
    };

    const send = async (p: GeolocationPosition) => {
      if (cancelled || posting || !worthPosting(p)) return;
      posting = true;
      const result = await postPosition(p);
      posting = false;
      if (cancelled || !result.ok) return;
      lastAt = Date.now();
      lastPoint = { lat: p.coords.latitude, lng: p.coords.longitude };
    };

    const stopWatch = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    const startWatch = async () => {
      if (cancelled || watchId !== null) return;
      if (!(await mayRead(false))) return;
      if (cancelled || watchId !== null) return;
      // High accuracy stays off: this is a geofence hundreds of metres across,
      // not turn-by-turn, and the GPS radio is not worth the battery for it.
      watchId = navigator.geolocation.watchPosition(
        p => { void send(p); },
        err => {
          noteGeoError(err);
          // A denial ends this for good; a timeout or a missing fix will be
          // retried by the heartbeat.
          if (err.code === err.PERMISSION_DENIED) stopWatch();
        },
        { enableHighAccuracy: false, timeout: 30_000, maximumAge: 60_000 },
      );
    };

    const beat = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (!(await mayRead(false))) return;
      const p = await readPosition();
      if (p) void send(p);
    };

    const start = () => {
      void startWatch();
      if (heartbeat === null) heartbeat = setInterval(() => { void beat(); }, HEARTBEAT_MS);
    };

    const stop = () => {
      stopWatch();
      if (heartbeat !== null) { clearInterval(heartbeat); heartbeat = null; }
    };

    // The watch is a foreground thing — a backgrounded PWA gets no fixes anyway,
    // and holding it open only invites the OS to keep the radio warm.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onVisibility);
    };
  }, []);

  return null;
}
