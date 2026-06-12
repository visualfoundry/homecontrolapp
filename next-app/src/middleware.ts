import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

/**
 * Protect device-control API routes with session cookie validation.
 *
 * /api/auth/exchange — excluded (bootstrap endpoint that creates the session)
 * /api/revalidate   — excluded (uses REVALIDATE_SECRET, called by WP server-side)
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
    '/api/spotify/:path*',
    '/api/cameras/:path*',
    '/api/debug',
    '/api/auth/check',
  ],
};
