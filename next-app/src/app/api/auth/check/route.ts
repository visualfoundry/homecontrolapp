import { NextResponse } from 'next/server';

/**
 * GET /api/auth/check
 *
 * Lightweight session validity probe. The middleware validates the hca_session
 * cookie before this handler runs — if we get here, the session is valid.
 * Returns 200 on valid session, 401 on missing/expired session (from middleware).
 */
export function GET() {
  return NextResponse.json({ ok: true });
}
