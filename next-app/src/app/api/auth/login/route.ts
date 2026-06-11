import { NextRequest, NextResponse } from 'next/server';
import { signSession } from '@/lib/auth';

/**
 * POST /api/auth/login
 * Body: { username: string, password: string }
 *
 * Validates WP credentials server-side by calling the custom WP REST endpoint
 * POST /wp-json/hca/v1/login (protected by X-HCA-Internal-Key). On success,
 * sets the hca_session HttpOnly cookie and returns 200.
 *
 * Credentials never touch the browser — this is a pure server-to-server call.
 */
export async function POST(req: NextRequest) {
  let username: string | undefined;
  let password: string | undefined;
  try {
    const body = (await req.json()) as { username?: unknown; password?: unknown };
    username = typeof body.username === 'string' ? body.username : undefined;
    password = typeof body.password === 'string' ? body.password : undefined;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  if (!username || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const internalKey = process.env.HCA_INTERNAL_KEY;
  if (!internalKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // Derive WP base URL from the existing GraphQL env var.
  const wpBase = (process.env.NEXT_PUBLIC_WP_GRAPHQL_URL ?? '').replace(/\/graphql$/, '');
  if (!wpBase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  let wpRes: Response;
  try {
    wpRes = await fetch(`${wpBase}/wp-json/hca/v1/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HCA-Internal-Key': internalKey,
      },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach authentication server' }, { status: 503 });
  }

  if (wpRes.status === 403) {
    console.error('HCA auth: WP returned 403 — check HCA_INTERNAL_KEY in wp-config.php matches .env.local');
    return NextResponse.json({ error: 'Auth server misconfigured' }, { status: 500 });
  }
  if (!wpRes.ok) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const { userId } = (await wpRes.json()) as { userId: number };
  const session = await signSession(userId);

  const out = NextResponse.json({ ok: true });
  out.cookies.set('hca_session', session, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60, // 8 hours
  });
  return out;
}
