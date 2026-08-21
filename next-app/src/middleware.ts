import { NextRequest, NextResponse } from 'next/server';
import {
  readSession, signSession, sessionCookieOptions,
  SESSION_COOKIE, SESSION_RENEW_AFTER,
} from '@/lib/auth';

/**
 * Protect device-control API routes with session cookie validation.
 *
 * /api/auth/exchange              — excluded (bootstrap that creates the session)
 * /api/auth/passkey/login-*       — excluded (pre-auth; create the session)
 * /api/revalidate                 — excluded (uses REVALIDATE_SECRET, called by WP)
 * /api/auth/passkey/register-*    — protected (must be logged in to enroll)
 */
export async function middleware(req: NextRequest) {
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const claims = await readSession(session);
  if (!claims) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = NextResponse.next();
  // Slide the expiry once the session is past halfway. The app polls these
  // routes constantly, so anyone still using it never reaches the hard expiry —
  // which is what made re-authentication feel arbitrary rather than earned.
  const remaining = claims.expiry - Math.floor(Date.now() / 1000);
  if (remaining < SESSION_RENEW_AFTER) {
    res.cookies.set(SESSION_COOKIE, await signSession(claims.userId), sessionCookieOptions);
  }
  return res;
}

export const config = {
  matcher: [
    '/api/state',
    '/api/stream',
    '/api/command',
    '/api/prefs',
    // Exactly '/api/presence' — the management API. NOT '/api/presence/:path*',
    // which would also catch the geofence webhook, whose whole point is to
    // authenticate on its own token from a phone that has no session.
    '/api/presence',
    '/api/presence/report',
    '/api/spotify/:path*',
    '/api/cameras/:path*',
    '/api/debug',
    '/api/auth/check',
    '/api/auth/passkey/register-options',
    '/api/auth/passkey/register-verify',
    '/api/push/subscribe',
  ],
};
