// GET /api/debug — exposes controlStateIds mapping for debugging
// Shows: WP databaseId → state service key, for all controls that have a state mapping.
// Also shows the raw /state snapshot keys (untranslated) when STATE_API_BASE_URL is set.

import { NextResponse } from 'next/server';
import { fetchConfig } from '@/lib/config';
import { STATE_API_BASE_URL } from '@/lib/state-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = await fetchConfig();
  const ids = cfg.controlStateIds ?? {};

  // Group by state key prefix (eisy0, eisy1, eisy2 …) for easy scanning
  const byPrefix: Record<string, Array<{ wpId: string; stateKey: string }>> = {};
  for (const [wpId, stateKey] of Object.entries(ids)) {
    const prefix = stateKey.split('/')[0] ?? 'other';
    if (!byPrefix[prefix]) byPrefix[prefix] = [];
    byPrefix[prefix].push({ wpId, stateKey });
  }
  for (const arr of Object.values(byPrefix)) arr.sort((a, b) => a.stateKey.localeCompare(b.stateKey));

  // Optionally fetch raw state keys from upstream
  let rawStateKeys: string[] | null = null;
  if (STATE_API_BASE_URL) {
    try {
      const res = await fetch(`${STATE_API_BASE_URL}/state`, { cache: 'no-store' });
      if (res.ok) {
        const snap = (await res.json()) as Record<string, unknown>;
        rawStateKeys = Object.keys(snap).filter(k => k !== 'ts').sort();
      }
    } catch {
      rawStateKeys = null;
    }
  }

  return NextResponse.json({
    totalMappings: Object.keys(ids).length,
    byPrefix,
    doorsExterior: cfg.doorsExterior,
    rawStateKeys,
  });
}
