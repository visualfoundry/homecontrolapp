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
    if (userId) {
      const wpBase = (process.env.NEXT_PUBLIC_WP_GRAPHQL_URL ?? '').replace(/\/graphql$/, '');
      const internalKey = process.env.HCA_INTERNAL_KEY ?? '';
      const r = await fetch(`${wpBase}/wp-json/hca/v1/user-info?userId=${userId}`, {
        headers: { 'X-HCA-Internal-Key': internalKey },
        signal: AbortSignal.timeout(3_000),
      });
      if (r.ok) {
        const data = await r.json() as { firstName?: string };
        firstName = data.firstName ?? '';
      }
    }
  } catch { /* non-fatal — greeting degrades gracefully without name */ }

  return NextResponse.json({ ok: true, firstName });
}
