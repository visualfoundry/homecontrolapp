'use client';

// =============================================================================
// PresenceReporter — the app reporting its own position
//
// On for everyone: there is no app-level switch, because the browser's location
// permission already is one, and a second switch on top of it only adds a way
// for presence to be quietly off. The OS prompt appears once, on the first open;
// after that this runs on open and on resume, which is the whole window a PWA
// gets. iOS never wakes a web app to check a geofence, so arrival and departure
// while the app is closed stay the job of the phone's own automation calling the
// presence link. Both write the same variable.
// =============================================================================

import { useEffect } from 'react';

export type Permissionish = 'granted' | 'denied' | 'prompt' | 'unknown';

/** What the browser currently thinks, without asking the user anything. */
export async function locationPermission(): Promise<Permissionish> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'denied';
  if (!navigator.permissions) return 'unknown';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return status.state as Permissionish;
  } catch {
    // Safari has not always supported querying geolocation this way.
    return 'unknown';
  }
}

export async function currentPosition(highAccuracy = false): Promise<GeolocationPosition | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      p => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: highAccuracy, timeout: 10_000, maximumAge: 120_000 },
    );
  });
}

export interface ReportResult {
  ok: boolean;
  person?: string;
  home?: boolean;
  distance?: number;
  error?: string;
}

/** Read the position and report it. Returns what the server made of it. */
export async function reportLocation(): Promise<ReportResult> {
  const position = await currentPosition();
  if (!position) return { ok: false, error: 'Location unavailable' };
  try {
    const res = await fetch('/api/presence/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }),
    });
    const data = await res.json().catch(() => ({})) as ReportResult;
    return res.ok ? { ...data, ok: true } : { ok: false, error: data.error ?? `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: 'Could not reach the app server' };
  }
}

export function PresenceReporter() {
  useEffect(() => {
    let cancelled = false;

    // First open asks; every later resume only reports if permission already
    // stands. Re-prompting on each resume would train people to deny it.
    const run = async (mayPrompt: boolean) => {
      if (cancelled) return;
      const state = await locationPermission();
      if (state === 'denied') return;
      if (state === 'prompt' && !mayPrompt) return;
      await reportLocation();
    };

    void run(true);

    const onResume = () => { if (document.visibilityState === 'visible') void run(false); };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('pageshow', onResume);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('pageshow', onResume);
    };
  }, []);

  return null;
}
