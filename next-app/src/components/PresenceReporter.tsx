'use client';

// =============================================================================
// PresenceReporter — the app reporting its own position
//
// Opt-in, because it asks for location permission and that should never be a
// surprise. Fires on open and on resume, which is the whole window a PWA gets:
// iOS will not wake a web app to check a geofence, so this keeps presence honest
// whenever the app is looked at, while the phone's own arrive/leave automation
// covers the app being closed. Same endpoint, same variable, either way.
// =============================================================================

import { useCallback, useEffect } from 'react';

export const PRESENCE_REPORT_KEY = 'hca:report_location';

/** Report once, if the user has opted in and already granted permission. */
export async function reportLocationOnce(force = false): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  if (!force && localStorage.getItem(PRESENCE_REPORT_KEY) !== '1') return;

  // Never trigger the permission prompt from a background resume — only from a
  // deliberate tap (force), which the Settings toggle supplies.
  if (!force && navigator.permissions) {
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (status.state !== 'granted') return;
    } catch { /* no Permissions API — fall through and try */ }
  }

  const position = await new Promise<GeolocationPosition | null>(resolve => {
    navigator.geolocation.getCurrentPosition(
      p => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 120_000 },
    );
  });
  if (!position) return;

  await fetch('/api/presence/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    }),
  }).catch(() => {});
}

export function PresenceReporter() {
  const report = useCallback(() => { void reportLocationOnce(); }, []);

  useEffect(() => {
    report();
    const onResume = () => { if (document.visibilityState === 'visible') report(); };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('pageshow', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('pageshow', onResume);
    };
  }, [report]);

  return null;
}
