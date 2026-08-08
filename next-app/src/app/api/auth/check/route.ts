import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/check
 *
 * Lightweight session validity probe. The middleware validates the hca_session
 * cookie before this handler runs — if we get here, the session is valid.
 * Returns { ok: true, firstName } on valid session, 401 from middleware otherwise.
 */
export async function GET(req: NextRequest) {
  let firstName = '';
  try {
    const session = req.cookies.get('hca_session')?.value ?? '';
    const userId = await verifySession(session);
    console.log('[check] userId:', userId, 'session length:', session.length);
    if (userId) {
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
