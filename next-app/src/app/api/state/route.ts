// GET /api/state — full state snapshot
// Proxies to the home-control service at STATE_API_BASE_URL.

import { NextResponse } from 'next/server';
import { STATE_API_BASE_URL, stateToConfigIds } from '@/lib/state-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!STATE_API_BASE_URL) {
    return NextResponse.json({ error: 'STATE_API_BASE_URL not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`${STATE_API_BASE_URL}/state`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    }
    const upstream = (await res.json()) as Record<string, unknown>;
    return NextResponse.json(await stateToConfigIds(upstream));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'state proxy failed' },
      { status: 502 },
    );
  }
}
