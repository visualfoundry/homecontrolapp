// GET|POST|DELETE /api/presence — presence link management (session-protected)
//
// GET    → { people: [{ personId, name, token?, last? }] }
// POST   → { personId } mints (or rotates) that person's link
// DELETE → { personId } revokes it

import { type NextRequest, NextResponse } from 'next/server';
import { sessionUserId } from '@/lib/session-guard';
import { listTokens, mintToken, revokeToken, lastReadings, homeCoords } from '@/lib/presence';
import { fetchConfig } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await sessionUserId(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const config = await fetchConfig();
  const tokens = listTokens();
  const last = lastReadings();
  const home = homeCoords();
  return NextResponse.json({
    home: home ? { radius: home.radius } : null,
    people: config.people.map(p => ({
      personId: p.id,
      name: p.name,
      token: tokens.find(t => t.personId === p.id)?.token ?? null,
      last: last[p.id] ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!(await sessionUserId(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null) as { personId?: string } | null;
  const personId = body?.personId;
  if (!personId) return NextResponse.json({ error: 'Missing personId' }, { status: 400 });

  const config = await fetchConfig();
  const person = config.people.find(p => p.id === personId);
  if (!person) return NextResponse.json({ error: 'Unknown personId' }, { status: 404 });

  return NextResponse.json({ ok: true, ...mintToken(personId, person.name) });
}

export async function DELETE(req: NextRequest) {
  if (!(await sessionUserId(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null) as { personId?: string } | null;
  if (!body?.personId) return NextResponse.json({ error: 'Missing personId' }, { status: 400 });
  revokeToken(body.personId);
  return NextResponse.json({ ok: true });
}
