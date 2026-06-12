import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { verifySession } from '@/lib/auth';
import { getRpConfig, signChallenge, getCredentials, CHALLENGE_COOKIE } from '@/lib/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/passkey/register-options
 *
 * Requires a valid hca_session cookie (user must already be logged in via password).
 * Returns WebAuthn registration options and stores the challenge in a short-lived cookie.
 */
export async function POST(req: NextRequest) {
  const session = req.cookies.get('hca_session')?.value;
  const userId = session ? await verifySession(session) : null;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { rpId, rpName } = getRpConfig();
  const existing = await getCredentials(userId);

  const options = await generateRegistrationOptions({
    rpID: rpId,
    rpName,
    userName: String(userId),
    userDisplayName: 'Home Control User',
    attestationType: 'none',
    excludeCredentials: existing.map(c => ({
      id: c.id,
      transports: c.transports,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  const signed = await signChallenge(options.challenge);

  const res = NextResponse.json(options);
  res.cookies.set(CHALLENGE_COOKIE, signed, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 120,
  });
  return res;
}
