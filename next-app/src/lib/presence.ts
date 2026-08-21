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
  /** personId → the MAC addresses of their devices, for Wi-Fi presence. */
  devices?: Record<string, string[]>;
  /** MAC → epoch ms this service last saw it on the network. Ours rather than
   *  the console's, because the newer UniFi API doesn't report a last-seen for
   *  clients that have dropped off — they simply stop being listed. */
  macSeen?: Record<string, number>;
  /** Set from the app ("use my current location"), so nobody has to hand-enter
   *  coordinates into an env file to make distance reports work. */
  home?: HomeCoords;
}

function read(): Store {
  try {
    const raw = JSON.parse(readFileSync(STORE, 'utf8')) as Partial<Store>;
    return {
      tokens: raw.tokens ?? [],
      last: raw.last ?? {},
      devices: raw.devices ?? {},
      macSeen: raw.macSeen ?? {},
      ...(raw.home ? { home: raw.home } : {}),
    };
  } catch {
    return { tokens: [], last: {}, devices: {}, macSeen: {} };
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

// ---------------------------------------------------------------------------
// Wi-Fi presence — device assignments and the last time each MAC was seen
// ---------------------------------------------------------------------------

export function deviceMap(): Record<string, string[]> {
  return read().devices ?? {};
}

export function setDevices(personId: string, macs: string[]): void {
  const store = read();
  store.devices = { ...(store.devices ?? {}) };
  const cleaned = macs.map(m => m.trim().toLowerCase()).filter(Boolean);
  if (cleaned.length) store.devices[personId] = cleaned;
  else delete store.devices[personId];
  write(store);
}

export function macsSeen(): Record<string, number> {
  return read().macSeen ?? {};
}

export function noteMacsSeen(macs: string[], at = Date.now()): void {
  if (!macs.length) return;
  const store = read();
  store.macSeen = { ...(store.macSeen ?? {}) };
  for (const mac of macs) store.macSeen[mac] = at;
  write(store);
}

/**
 * What each person's EISY variable actually says right now, keyed by person id.
 *
 * The sweep converges on this rather than on its own memory of what it last
 * wrote. Anything else can move these variables — an ISY program, a tile tap,
 * or another presence source entirely — and a sweep that trusts its own memory
 * would see no change to make and leave a wrong value standing indefinitely.
 */
export async function currentPresence(): Promise<Record<string, boolean>> {
  const { fetchConfig } = await import('@/lib/config');
  const { STATE_API_BASE_URL } = await import('@/lib/state-service');
  if (!STATE_API_BASE_URL) return {};

  try {
    const [config, res] = await Promise.all([
      fetchConfig(),
      fetch(`${STATE_API_BASE_URL}/state`, { cache: 'no-store', signal: AbortSignal.timeout(6_000) }),
    ]);
    if (!res.ok) return {};
    const snapshot = await res.json() as Record<string, { on?: boolean } | undefined>;
    const out: Record<string, boolean> = {};
    for (const person of config.people) {
      const stateId = config.controlStateIds[person.id];
      const value = stateId ? snapshot[stateId]?.on : undefined;
      if (typeof value === 'boolean') out[person.id] = value;
    }
    return out;
  } catch {
    return {};
  }
}
