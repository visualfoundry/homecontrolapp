// GET /api/presence/clients — Wi-Fi clients, for assigning devices to people.
// POST — { personId, macs: string[] } saves an assignment.

import { type NextRequest, NextResponse } from 'next/server';
import { sessionUserId } from '@/lib/session-guard';
import { listClients } from '@/lib/unifi-network';
import { deviceMap, setDevices } from '@/lib/presence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await sessionUserId(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { clients, error } = await listClients();
  return NextResponse.json({
    error,
    assigned: deviceMap(),
    // Wireless only: a wired client says nothing about whether a person is home.
    clients: clients
      .filter(c => !c.wired)
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export async function POST(req: NextRequest) {
  if (!(await sessionUserId(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null) as
    { personId?: string; macs?: string[] } | null;
  if (!body?.personId || !Array.isArray(body.macs)) {
    return NextResponse.json({ error: 'Missing personId or macs' }, { status: 400 });
  }
  setDevices(body.personId, body.macs);
  return NextResponse.json({ ok: true, assigned: deviceMap() });
}
