// GET /api/state — full state snapshot
// Returns the current flat device state map seeded from buildInitialState().
// In M5 this route is replaced by GET STATE_API_BASE_URL/state on the real service.

import { NextResponse } from 'next/server';
import { getMockState } from '@/lib/mock-state';

export const dynamic = 'force-dynamic';

export function GET() {
  const state = getMockState();
  return NextResponse.json({ ...state, ts: new Date().toISOString() });
}
