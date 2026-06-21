import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

/**
 * Protect device-control API routes with session cookie validation.
 *
 * /api/auth/exchange              — excluded (bootstrap that creates the session)
 * /api/auth/passkey/login-*       — excluded (pre-auth; create the session)
 * /api/revalidate                 — excluded (uses REVALIDATE_SECRET, called by WP)
 * /api/auth/passkey/register-*    — protected (must be logged in to enroll)
 */
export async function middleware(req: NextRequest) {
  const session = req.cookies.get('hca_session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = await verifySession(session);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/state',
    '/api/stream',
    '/api/command',
    '/api/prefs',
    '/api/spotify/:path*',
    '/api/cameras/:path*',
    '/api/debug',
    '/api/auth/check',
    '/api/auth/passkey/register-options',
    '/api/auth/passkey/register-verify',
    '/api/push/subscribe',
  ],
};
