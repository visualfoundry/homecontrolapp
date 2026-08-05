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
export async function POST(req: NextRequest) {
  const { rpId } = getRpConfig();

  // The client sends its enrolled credential ID so we can pin to that one device's
  // credential — iOS then goes straight to Face ID without showing the passkey picker.
  let credentialId: string | undefined;
  try {
    const body = await req.json() as { credentialId?: string };
    credentialId = typeof body.credentialId === 'string' ? body.credentialId : undefined;
  } catch { /* empty / non-JSON body is fine */ }

  const all = await getAllCredentials();

  // Filter to the device's own credential; fall back to all if the hint is missing or stale.
  const hinted = credentialId ? all.filter(c => c.id === credentialId) : [];
  const allowed = hinted.length > 0 ? hinted : all;

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: 'preferred',
    allowCredentials: allowed.map(c => ({
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
