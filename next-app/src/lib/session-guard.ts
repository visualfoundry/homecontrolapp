// =============================================================================
// Session guard — the check the middleware can't make
//
// The middleware validates the cookie's signature and expiry, but it runs on the
// Edge runtime: it cannot read WP, and calling out to it on every request would
// tax the hottest path in the app. So revocation is enforced here, in the Node
// route handlers the app actually talks to — /state and /stream in particular,
// which the app calls constantly, so a WP sign-out surfaces within a second.
// =============================================================================

import type { NextRequest } from 'next/server';
import { readSession, SESSION_COOKIE } from '@/lib/auth';
import { isRevoked } from '@/lib/session-revocation';

/** The signed-in user id, or null when the request should be refused. */
export async function sessionUserId(req: NextRequest): Promise<number | null> {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  const claims = await readSession(cookie);
  if (!claims) return null;
  if (await isRevoked(claims.userId, claims.issuedAt)) return null;
  return claims.userId;
}
