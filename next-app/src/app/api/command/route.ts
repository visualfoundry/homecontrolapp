// POST /api/command — issue a device change or scene activation
//
// Body shapes (per state-contract.md):
//   { "target": "lr-main",  "patch":  { "level": 40 } }
//   { "target": "d-front",  "patch":  { "locked": true } }
//   { "target": "movie",    "action": "activate" }
//   { "target": "iz-bg",    "action": "run" }
//
// Returns 202 immediately. After ~200 ms the mock emits the matching /stream
// patch so the optimistic→reconcile cycle (M4) runs end to end.
//
// In M5 the client POSTs to STATE_API_BASE_URL/command on the real service.

import { applyCommand } from '@/lib/mock-state';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface CommandBody {
  target: string;
  patch?: Record<string, unknown>;
  action?: string;
}

export async function POST(req: NextRequest) {
  let body: CommandBody;
  try {
    body = (await req.json()) as CommandBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.target) {
    return NextResponse.json({ error: 'Missing target' }, { status: 400 });
  }

  applyCommand(body.target, body.patch, body.action);

  return new Response(null, { status: 202 });
}
