// =============================================================================
// Presence — geofence ingress, replacing Locative → ISY Portal
//
// The EISY variable behind each "Geo <Name> at Home" control stays the source of
// truth, so every ISY program keyed on presence is untouched: all that changes is
// who sets it. A phone's own geofence automation (iOS Shortcuts, Tasker) calls
// /api/presence/<token>, which resolves the person and writes that variable
// through the same command path a tile tap uses.
//
// Tokens live in a file beside push-alerts.json rather than in WP: they are
// credentials for one narrow endpoint, minted and revoked from the app itself,
// and WP has no other reason to know them.
// =============================================================================

import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STORE = join(process.cwd(), '..', 'presence.json');

export type PresenceSource = 'geofence' | 'app' | 'wifi' | 'manual';

export interface PresenceToken {
  token: string;
  personId: string;
  label: string;
  createdAt: number;
}

export interface PresenceReading {
  home: boolean;
  source: PresenceSource;
  at: number;
  /** Metres from home, when the caller sent coordinates. */
  distance?: number;
}

export interface HomeCoords { lat: number; lng: number; radius: number }

interface Store {
  tokens: PresenceToken[];
  last: Record<string, PresenceReading>;
  /** Set from the app ("use my current location"), so nobody has to hand-enter
   *  coordinates into an env file to make distance reports work. */
  home?: HomeCoords;
}

function read(): Store {
  try {
    const raw = JSON.parse(readFileSync(STORE, 'utf8')) as Partial<Store>;
    return { tokens: raw.tokens ?? [], last: raw.last ?? {}, ...(raw.home ? { home: raw.home } : {}) };
  } catch {
    return { tokens: [], last: {} };
  }
}

function write(store: Store): void {
  try {
    writeFileSync(STORE, JSON.stringify(store, null, 2));
  } catch {
    // Read-only filesystem — presence still applies, it just won't survive a
    // restart. Losing the audit trail beats refusing to open the door.
  }
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export function listTokens(): PresenceToken[] {
  return read().tokens;
}

/** One token per person; minting again rotates it, which is how a lost phone is
 *  cut off. */
export function mintToken(personId: string, label: string): PresenceToken {
  const store = read();
  const token: PresenceToken = {
    token: randomBytes(24).toString('base64url'),
    personId,
    label,
    createdAt: Date.now(),
  };
  store.tokens = [...store.tokens.filter(t => t.personId !== personId), token];
  write(store);
  return token;
}

export function revokeToken(personId: string): void {
  const store = read();
  store.tokens = store.tokens.filter(t => t.personId !== personId);
  write(store);
}

export function personForToken(token: string): PresenceToken | null {
  return read().tokens.find(t => t.token === token) ?? null;
}

// ---------------------------------------------------------------------------
// Readings
// ---------------------------------------------------------------------------

export function lastReadings(): Record<string, PresenceReading> {
  return read().last;
}

export function recordReading(personId: string, reading: PresenceReading): void {
  const store = read();
  store.last[personId] = reading;
  write(store);
}

// ---------------------------------------------------------------------------
// Home coordinates — only needed for coordinate-based reports (the app on
// resume, or a Shortcut that sends a location instead of an event).
// ---------------------------------------------------------------------------

export function homeCoords(): HomeCoords | null {
  const lat = Number(process.env.HOME_LAT);
  const lng = Number(process.env.HOME_LNG);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const radius = Number(process.env.HOME_RADIUS_M);
    return { lat, lng, radius: Number.isFinite(radius) && radius > 0 ? radius : 150 };
  }
  return read().home ?? null;
}

export function setHomeCoords(coords: HomeCoords): void {
  const store = read();
  store.home = coords;
  write(store);
}

/** Metres between two points (haversine — flat-earth error is irrelevant at
 *  geofence scale, but the formula costs nothing). */
export function distanceMetres(
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

// ---------------------------------------------------------------------------
// Applying a reading
// ---------------------------------------------------------------------------

/**
 * Write a person's presence to the EISY variable behind their WP control, which
 * is what every ISY program keyed on presence actually reads. Returns false if
 * the person has no variable or the state service refused it.
 */
export async function applyPresence(
  personId: string,
  home: boolean,
  source: PresenceSource,
  distance?: number,
): Promise<boolean> {
  const { fetchConfig } = await import('@/lib/config');
  const { STATE_API_BASE_URL } = await import('@/lib/state-service');

  const config = await fetchConfig();
  const stateId = config.controlStateIds[personId];
  if (!stateId || !STATE_API_BASE_URL) return false;

  try {
    const res = await fetch(`${STATE_API_BASE_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: stateId, patch: { on: home } }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok && res.status !== 202) return false;
  } catch {
    return false;
  }

  recordReading(personId, {
    home,
    source,
    at: Date.now(),
    ...(distance !== undefined ? { distance } : {}),
  });
  return true;
}
