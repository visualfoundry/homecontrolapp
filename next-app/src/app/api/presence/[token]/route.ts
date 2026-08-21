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
  personForToken, applyPresence, homeCoords, distanceMetres,
  type PresenceSource,
} from '@/lib/presence';

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

  const ok = await applyPresence(entry.personId, intent.home, source, intent.distance);
  if (!ok) {
    return NextResponse.json({ error: 'Could not write presence' }, { status: 502 });
  }

  console.log(`[presence] ${entry.label} → ${intent.home ? 'home' : 'away'} (${source})`);
  return NextResponse.json({ ok: true, person: entry.label, home: intent.home });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handle(req, (await ctx.params).token);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return handle(req, (await ctx.params).token);
}
