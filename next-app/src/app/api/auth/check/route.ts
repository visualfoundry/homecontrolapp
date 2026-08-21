import { NextRequest, NextResponse } from 'next/server';
import { sessionUserId } from '@/lib/session-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/check
 *
 * Lightweight session validity probe, and the one AuthGate decides on at startup.
 * The middleware has already checked the cookie's signature and expiry; this also
 * rejects a session WP has withdrawn (Users → "Sign out app").
 * Returns { ok: true, firstName }, or 401 if the session is invalid or revoked.
 */
export async function GET(req: NextRequest) {
  // A withdrawn session must fail the probe too, or the app would sail past the
  // login screen on startup and only discover it on the first device call.
  const sessionUser = await sessionUserId(req);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let firstName = '';
  try {
    const userId = sessionUser;
    {
      const wpBase = (process.env.NEXT_PUBLIC_WP_GRAPHQL_URL ?? '').replace(/\/graphql$/, '');
      const internalKey = process.env.HCA_INTERNAL_KEY ?? '';
      const url = `${wpBase}/wp-json/hca/v1/user-info?userId=${userId}`;
      console.log('[check] fetching:', url, 'key set:', !!internalKey);
      const r = await fetch(url, {
        headers: { 'X-HCA-Internal-Key': internalKey },
        signal: AbortSignal.timeout(3_000),
      });
      console.log('[check] wp status:', r.status);
      if (r.ok) {
        const data = await r.json() as { firstName?: string };
        firstName = data.firstName ?? '';
        console.log('[check] firstName:', firstName);
      }
    }
  } catch (err) { console.error('[check] error:', err); }

  return NextResponse.json({ ok: true, firstName });
}
