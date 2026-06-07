// POST /api/command — issue a device change or scene activation
//
// Body shapes (per state-contract.md):
//   { "target": "lr-main",  "patch":  { "level": 40 } }
//   { "target": "movie",    "action": "activate" }
//
// Proxy boundary: forward to the real service's POST /command when
// STATE_API_BASE_URL is set (translating target id), else apply to the mock.
// Returns 202 immediately; the confirmed patch arrives on /stream.

import { applyCommand } from '@/lib/mock-state';
import { STATE_API_BASE_URL, commandTargetToStateId } from '@/lib/state-service';
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

  if (!STATE_API_BASE_URL) {
    applyCommand(body.target, body.patch, body.action);
    return new Response(null, { status: 202 });
  }

  try {
    const target = await commandTargetToStateId(body.target);
    const res = await fetch(`${STATE_API_BASE_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, target }),
    });
    return new Response(null, { status: res.status === 202 ? 202 : res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'command proxy failed' },
      { status: 502 },
    );
  }
}
