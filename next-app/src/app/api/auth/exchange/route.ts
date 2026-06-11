import { NextRequest, NextResponse } from 'next/server';
import { verifyWpToken, signSession } from '@/lib/auth';

/**
 * POST /api/auth/exchange
 * Body: { token: string }  — the WP-generated HMAC init token from the page meta tag.
 *
 * Verifies the WP token, then sets an HttpOnly hca_session cookie for the Next.js
 * origin. All subsequent API requests (including EventSource) carry the cookie
 * automatically — no custom headers needed.
 */
export async function POST(req: NextRequest) {
  let token: string | undefined;
  try {
    const body = (await req.json()) as { token?: unknown };
    token = typeof body.token === 'string' ? body.token : undefined;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const userId = await verifyWpToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await signSession(userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('hca_session', session, {
    httpOnly: true,
    sameSite: 'lax', // lax (not strict) so WP login redirect lands with cookie intact
    path: '/',
    maxAge: 8 * 60 * 60, // 8 hours
  });
  return res;
}
