import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getRpConfig, signChallenge, getAllCredentials, CHALLENGE_COOKIE } from '@/lib/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/passkey/login-options
 *
 * No session required — this is a pre-authentication step.
 * Returns WebAuthn authentication options (discoverable credential flow:
 * no userId needed; the device selects the matching passkey).
 */
export async function POST(_req: NextRequest) {
  const { rpId } = getRpConfig();

  // Fetch all stored credentials so the authenticator can auto-select.
  const all = await getAllCredentials();

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: 'preferred',
    allowCredentials: all.map(c => ({
      id: c.id,
      transports: c.transports,
    })),
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
