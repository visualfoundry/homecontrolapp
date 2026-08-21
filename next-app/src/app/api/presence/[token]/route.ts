// POST|GET /api/presence/<token>
//
// The geofence webhook. Called by the phone's own automation — iOS Shortcuts,
// Tasker — so it authenticates on the token in the path rather than the session
// cookie, and is deliberately outside the middleware's matcher.
//
// Accepts what the callers can send most easily:
//   ?home=1|0        our own form
//   ?trigger=enter|exit   Locative's, so an existing Locative setup can be
//                         re-pointed here during the changeover
//   ?lat=&lon=       a position instead of an event, resolved against HOME_LAT/LNG
//
// GET is supported because Shortcuts' "Get Contents of URL" defaults to it and
// this needs to be pasteable by a human on a phone.

import { type NextRequest, NextResponse } from 'next/server';
import {
  personForToken, recordReading, homeCoords, distanceMetres,
  type PresenceSource,
} from '@/lib/presence';
import { fetchConfig } from '@/lib/config';
import { STATE_API_BASE_URL } from '@/lib/state-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Resolve enter/leave from whatever the caller sent. */
function readIntent(p: URLSearchParams): { home: boolean; distance?: number } | null {
  const home = p.get('home');
  if (home !== null) return { home: home === '1' || home.toLowerCase() === 'true' };

  const trigger = (p.get('trigger') ?? p.get('event') ?? '').toLowerCase();
  if (trigger === 'enter' || trigger === 'arrive') return { home: true };
  if (trigger === 'exit' || trigger === 'leave') return { home: false };

  const lat = Number(p.get('lat') ?? p.get('latitude'));
  const lng = Number(p.get('lon') ?? p.get('lng') ?? p.get('longitude'));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const home = homeCoords();
    if (!home) return null;
    const distance = distanceMetres(home, { lat, lng });
    return { home: distance <= home.radius, distance: Math.round(distance) };
  }
  return null;
}

async function handle(req: NextRequest, token: string) {
  const entry = personForToken(token);
  if (!entry) {
    // Deliberately vague: this endpoint is reachable by anything that has the
    // URL, so it shouldn't confirm which half of it was wrong.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  // A POSTed JSON body is merged in, so either style works.
  if (req.method === 'POST') {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    for (const [k, v] of Object.entries(body ?? {})) {
      if (v !== null && v !== undefined && !params.has(k)) params.set(k, String(v));
    }
  }

  const intent = readIntent(params);
  if (!intent) {
    return NextResponse.json(
      { error: 'Send home=1|0, trigger=enter|exit, or lat & lon' },
      { status: 400 },
    );
  }

  const source = (params.get('source') as PresenceSource | null) ?? 'geofence';

  // The EISY variable behind the person's WP control is the source of truth.
  const config = await fetchConfig();
  const stateId = config.controlStateIds[entry.personId];
  if (!stateId) {
    return NextResponse.json({ error: 'No state id for that person' }, { status: 500 });
  }
  if (!STATE_API_BASE_URL) {
    return NextResponse.json({ error: 'STATE_API_BASE_URL not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`${STATE_API_BASE_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: stateId, patch: { on: intent.home } }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok && res.status !== 202) {
      return NextResponse.json({ error: `state service ${res.status}` }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: 'state service unreachable' }, { status: 502 });
  }

  recordReading(entry.personId, {
    home: intent.home,
    source,
    at: Date.now(),
    ...(intent.distance !== undefined ? { distance: intent.distance } : {}),
  });

  console.log(`[presence] ${entry.label} → ${intent.home ? 'home' : 'away'} (${source})`);
  return NextResponse.json({ ok: true, person: entry.label, home: intent.home });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handle(req, (await ctx.params).token);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handle(req, (await ctx.params).token);
}
