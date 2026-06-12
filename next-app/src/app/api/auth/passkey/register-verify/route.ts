import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { verifySession } from '@/lib/auth';
import {
  getRpConfig,
  verifyAndClearChallenge,
  storeCredential,
  CHALLENGE_COOKIE,
} from '@/lib/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/passkey/register-verify
 *
 * Verifies the credential created by the browser and stores it in WP user meta.
 * Requires a valid hca_session cookie.
 */
export async function POST(req: NextRequest) {
  const session = req.cookies.get('hca_session')?.value;
  const userId = session ? await verifySession(session) : null;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expectedChallenge = await verifyAndClearChallenge(
    req.cookies.get(CHALLENGE_COOKIE)?.value,
  );
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Challenge expired or invalid' }, { status: 400 });
  }

  let body: RegistrationResponseJSON;
  try {
    body = (await req.json()) as RegistrationResponseJSON;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { rpId } = getRpConfig();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: req.headers.get('origin') ?? `https://${rpId}`,
      expectedRPID: rpId,
    });
  } catch (err) {
    console.error('passkey register-verify error:', err);
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;

  const stored = await storeCredential({
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    signCount: credential.counter,
    transports: (body.response.transports ?? []) as import('@simplewebauthn/server').AuthenticatorTransportFuture[],
    name: 'Face ID',
    userId,
    createdAt: Math.floor(Date.now() / 1000),
  });

  if (!stored) {
    return NextResponse.json({ error: 'Could not save credential' }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CHALLENGE_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
