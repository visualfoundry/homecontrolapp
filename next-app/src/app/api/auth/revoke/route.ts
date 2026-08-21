import { NextRequest, NextResponse } from 'next/server';
import { setEpoch } from '@/lib/session-revocation';

/**
 * POST /api/auth/revoke
 * Body: { secret, userId, epoch }
 *
 * Called by WordPress when an admin uses "Sign out app" on the Users screen.
 * Shares REVALIDATE_SECRET with the config-revalidation webhook — same trust
 * boundary: a WP-to-Next call that never touches the browser.
 *
 * The epoch is also readable from WP, so this endpoint is an optimisation, not
 * the record: it makes the sign-out immediate instead of waiting out the cache
 * TTL. WP remains the source of truth.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as
    { secret?: string; userId?: number; epoch?: number } | null;

  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || body?.secret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = Number(body?.userId);
  const epoch = Number(body?.epoch);
  if (!userId || !epoch) {
    return NextResponse.json({ error: 'Missing userId or epoch' }, { status: 400 });
  }

  setEpoch(userId, epoch);
  return NextResponse.json({ ok: true, userId, epoch });
}
