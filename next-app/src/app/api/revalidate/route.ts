// =============================================================================
// On-demand revalidation route — Home Control App
//
// Called by WordPress (functions.php → homecontrolapp_trigger_revalidation)
// when a post is saved. Invalidates the 'hca-config' cache tag so the next
// page request triggers a fresh ISR fetch from WPGraphQL.
//
// WP posts to: POST /api/revalidate
// Body: { "secret": "..." }
//
// The REVALIDATE_SECRET must match the value in wp-config.php.
// =============================================================================

import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { resetIdMaps } from '@/lib/state-service';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const secret = (body as Record<string, unknown>)?.secret;
  const expected = process.env.REVALIDATE_SECRET;

  if (!expected) {
    console.error('[revalidate] REVALIDATE_SECRET env var is not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  if (typeof secret !== 'string' || secret !== expected) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  revalidateTag('hca-config');
  resetIdMaps();

  return NextResponse.json({ revalidated: true });
}
