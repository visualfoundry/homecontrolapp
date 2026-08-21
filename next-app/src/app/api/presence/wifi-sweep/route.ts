// POST /api/presence/wifi-sweep — one pass of Wi-Fi presence.
//
// Driven by cron rather than a timer in this process, matching how the alert
// re-sends already work: a Next server can be restarted at any moment, and a
// missed tick then costs nothing.
//
// Asymmetric on purpose. Seeing a device is proof of presence, so home applies at
// once. Not seeing one is weak evidence — phones sleep their radios, and a
// console can drop a client briefly — so away waits for a grace period of silence.
// Getting this backwards means the house declares everyone out while they are
// asleep upstairs.

import { type NextRequest, NextResponse } from 'next/server';
import { listClients } from '@/lib/unifi-network';
import {
  deviceMap, macsSeen, noteMacsSeen, applyPresence, lastReadings,
} from '@/lib/presence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Silence before a device counts as gone. */
const AWAY_AFTER_MS = 12 * 60 * 1000;

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-hca-internal-key');
  if (!key || key !== process.env.HCA_INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const devices = deviceMap();
  if (Object.keys(devices).length === 0) {
    return NextResponse.json({ ok: true, note: 'no devices assigned' });
  }

  const { clients, error } = await listClients();
  if (error) return NextResponse.json({ ok: false, error }, { status: 502 });

  const now = Date.now();
  const present = new Set(clients.filter(c => !c.wired).map(c => c.mac));
  noteMacsSeen([...present], now);

  const seen = macsSeen();
  const last = lastReadings();
  const changed: Array<{ personId: string; home: boolean }> = [];

  for (const [personId, macs] of Object.entries(devices)) {
    const anyPresent = macs.some(m => present.has(m));
    const quietFor = Math.min(...macs.map(m => now - (seen[m] ?? 0)));
    const home = anyPresent ? true : quietFor < AWAY_AFTER_MS ? null : false;
    if (home === null) continue; // inside the grace window — leave it alone

    // Only write on a change, so this doesn't fight a geofence report that said
    // the same thing a second ago.
    if (last[personId]?.home === home) continue;
    if (await applyPresence(personId, home, 'wifi')) {
      changed.push({ personId, home });
    }
  }

  if (changed.length) console.log('[presence] wifi sweep changed:', JSON.stringify(changed));
  return NextResponse.json({ ok: true, wireless: present.size, changed });
}
