// POST /api/presence/report — the app reporting its own position
//
// Session-authenticated, so it needs no token: the signed-in WP user is matched
// to their "Geo <Name> at Home" person by first name. Static segment, so it wins
// over the [token] route next to it.
//
// This is the app doing what it can do — report while it is running. The client
// watches the position for as long as it is open, so crossing the fence with the
// app in hand shows up at once. iOS will not wake a web app to check a geofence,
// so the phone's own automation still covers arrival and departure while the app
// is closed. Both write the same variable.

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
    { lat?: number; lng?: number; accuracy?: number; setHome?: boolean; radius?: number } | null;
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

  // How far the fix could be off, when the app sent it.
  //
  // Indoors a phone can place itself a kilometre from where it is, on Wi-Fi
  // alone, and now that the app reports continuously rather than once per open,
  // one such fix would put someone out of the house while they are asleep in it.
  // So a fix that says "home" is taken at face value — nothing else puts you
  // inside your own fence — while "away" has to mean the whole uncertainty
  // circle is outside it. A fix that can't tell leaves presence as it stands.
  const accuracy = Number(body?.accuracy);
  const margin = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 0;
  if (!isHome && distance - margin <= home.radius) {
    console.log(
      `[presence] ${person.name} → unchanged (app, ${distance} m ±${Math.round(margin)} m)`,
    );
    return NextResponse.json({
      ok: true, person: person.name, unchanged: true, distance,
      accuracy: Math.round(margin),
    });
  }

  const ok = await applyPresence(person.id, isHome, 'app', distance);
  if (!ok) return NextResponse.json({ error: 'Could not write presence' }, { status: 502 });

  console.log(`[presence] ${person.name} → ${isHome ? 'home' : 'away'} (app, ${distance} m)`);
  return NextResponse.json({ ok: true, person: person.name, home: isHome, distance });
}
