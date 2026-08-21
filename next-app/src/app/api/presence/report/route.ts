// POST /api/presence/report — the app reporting its own position
//
// Session-authenticated, so it needs no token: the signed-in WP user is matched
// to their "Geo <Name> at Home" person by first name. Static segment, so it wins
// over the [token] route next to it.
//
// This is the app doing what it can do — report while it is running. iOS will not
// wake a web app to check a geofence, so this makes presence right whenever the
// app is opened, and the phone's own automation covers arrival and departure
// while the app is closed. Both write the same variable.

import { type NextRequest, NextResponse } from 'next/server';
import { sessionUserId } from '@/lib/session-guard';
import { applyPresence, homeCoords, distanceMetres, setHomeCoords } from '@/lib/presence';
import { fetchConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The person whose presence this user owns, matched on WP first name. */
async function personForUser(userId: number): Promise<{ id: string; name: string } | null> {
  const base = (process.env.NEXT_PUBLIC_WP_GRAPHQL_URL ?? '').replace(/\/graphql$/, '');
  const key = process.env.HCA_INTERNAL_KEY ?? '';
  let firstName = '';
  try {
    const r = await fetch(`${base}/wp-json/hca/v1/user-info?userId=${userId}`, {
      headers: { 'X-HCA-Internal-Key': key },
      signal: AbortSignal.timeout(4_000),
    });
    if (r.ok) firstName = ((await r.json()) as { firstName?: string }).firstName ?? '';
  } catch { /* fall through */ }
  if (!firstName) return null;

  const config = await fetchConfig();
  const hit = config.people.find(p => p.name.toLowerCase() === firstName.toLowerCase());
  return hit ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await sessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as
    { lat?: number; lng?: number; setHome?: boolean; radius?: number } | null;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Missing lat/lng' }, { status: 400 });
  }

  // "Use my current location as home" — the only way to set the reference point
  // without hand-editing coordinates into an env file.
  if (body?.setHome) {
    const radius = Number(body.radius);
    setHomeCoords({ lat, lng, radius: Number.isFinite(radius) && radius > 0 ? radius : 150 });
    return NextResponse.json({ ok: true, action: 'home-set', lat, lng });
  }

  const home = homeCoords();
  if (!home) {
    return NextResponse.json(
      { error: 'No home location set — use "Set home to here" first' },
      { status: 409 },
    );
  }

  const person = await personForUser(userId);
  if (!person) {
    return NextResponse.json(
      { error: 'No presence control matches your WP first name' },
      { status: 409 },
    );
  }

  const distance = Math.round(distanceMetres(home, { lat, lng }));
  const isHome = distance <= home.radius;
  const ok = await applyPresence(person.id, isHome, 'app', distance);
  if (!ok) return NextResponse.json({ error: 'Could not write presence' }, { status: 502 });

  console.log(`[presence] ${person.name} → ${isHome ? 'home' : 'away'} (app, ${distance} m)`);
  return NextResponse.json({ ok: true, person: person.name, home: isHome, distance });
}
