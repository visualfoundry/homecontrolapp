import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { signSession } from '@/lib/auth';
import {
  getRpConfig,
  verifyAndClearChallenge,
  getAllCredentials,
  updateSignCount,
  CHALLENGE_COOKIE,
} from '@/lib/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/passkey/login-verify
 *
 * No session required — this creates the session on success.
 * Verifies the assertion, updates the signCount, and sets hca_session cookie.
 */
export async function POST(req: NextRequest) {
  const expectedChallenge = await verifyAndClearChallenge(
    req.cookies.get(CHALLENGE_COOKIE)?.value,
  );
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Challenge expired or invalid' }, { status: 400 });
  }

  let body: AuthenticationResponseJSON;
  try {
    body = (await req.json()) as AuthenticationResponseJSON;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  // Find the matching stored credential by ID.
  const all = await getAllCredentials();
  const stored = all.find(c => c.id === body.id || c.id === body.rawId);
  if (!stored) {
    return NextResponse.json({ error: 'Unknown credential' }, { status: 400 });
  }

  const { rpId } = getRpConfig();

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: req.headers.get('origin') ?? `https://${rpId}`,
      expectedRPID: rpId,
      credential: {
        id: stored.id,
        publicKey: Buffer.from(stored.publicKey, 'base64url'),
        counter: stored.signCount,
        transports: stored.transports,
      },
    });
  } catch (err) {
    console.error('passkey login-verify error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 401 });
  }

  // Update signCount to guard against cloned authenticators.
  await updateSignCount(stored.id, verification.authenticationInfo.newCounter);

  const session = await signSession(stored.userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('hca_session', session, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
  res.cookies.set(CHALLENGE_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
