// GET /api/state — full state snapshot
//
// Proxy boundary (the "adapter" in the contracts): when STATE_API_BASE_URL is
// set, forward to the real home-control service's GET /state; otherwise serve
// the mock. The browser always talks to this same-origin route (no CORS).

import { NextResponse } from 'next/server';
import { getMockState } from '@/lib/mock-state';
import { STATE_API_BASE_URL, stateToConfigIds } from '@/lib/state-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!STATE_API_BASE_URL) {
    const state = getMockState();
    return NextResponse.json({ ...state, ts: new Date().toISOString() });
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
