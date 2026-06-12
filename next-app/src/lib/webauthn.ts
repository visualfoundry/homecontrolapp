/**
 * WebAuthn / Passkey helpers — server-side only.
 *
 * Challenge lifecycle: options route generates a random challenge, signs it
 * with NEXTAUTH_SECRET, stores the signed string in an HttpOnly cookie
 * (hca_webauthn_challenge, 2-min TTL). The verify route reads the cookie,
 * verifies the HMAC + expiry, and clears it — ensures the challenge is
 * single-use and tamper-proof without a server-side session store.
 *
 * Credential storage: WP user meta via GET/POST/PATCH/DELETE
 * /wp-json/hca/v1/webauthn/credentials (protected by X-HCA-Internal-Key).
 */

import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';

export interface StoredCredential {
  id: string;          // base64url credential ID
  publicKey: string;   // base64url-encoded COSE public key
  signCount: number;
  transports: AuthenticatorTransportFuture[];
  name: string;        // user-friendly label ("Face ID", "Touch ID", etc.)
  userId: number;      // WP user ID
  createdAt: number;   // unix timestamp
}

// ---------------------------------------------------------------------------
// RP config
// ---------------------------------------------------------------------------

export function getRpConfig(): { rpId: string; rpName: string } {
  return {
    rpId:   process.env.WEBAUTHN_RP_ID   ?? 'localhost',
    rpName: process.env.WEBAUTHN_RP_NAME ?? 'Home Control',
  };
}

// ---------------------------------------------------------------------------
// Challenge cookie — HMAC-signed, 2-minute TTL
// ---------------------------------------------------------------------------

const CHALLENGE_TTL = 2 * 60; // seconds
const CHALLENGE_COOKIE = 'hca_webauthn_challenge';

async function getSessionKey(): Promise<CryptoKey> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET env var is not set');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function hmacHex(message: string): Promise<string> {
  const key = await getSessionKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacVerify(message: string, hexSig: string): Promise<boolean> {
  if (hexSig.length % 2 !== 0) return false;
  const key = await getSessionKey();
  const sigBytes = new Uint8Array((hexSig.match(/.{2}/g) ?? []).map(b => parseInt(b, 16)));
  try {
    return await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(message));
  } catch {
    return false;
  }
}

export async function signChallenge(challenge: string): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + CHALLENGE_TTL;
  const payload = `${challenge}|${expiry}`;
  const sig = await hmacHex(payload);
  return `${payload}.${sig}`;
}

export async function verifyAndClearChallenge(
  cookieValue: string | undefined,
): Promise<string | null> {
  if (!cookieValue) return null;
  const dot = cookieValue.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  if (!(await hmacVerify(payload, sig))) return null;
  const [challenge, expiryStr] = payload.split('|');
  if (Math.floor(Date.now() / 1000) > parseInt(expiryStr, 10)) return null;
  return challenge;
}

export { CHALLENGE_COOKIE };

// ---------------------------------------------------------------------------
// WP credential storage helpers (server-to-server via HCA_INTERNAL_KEY)
// ---------------------------------------------------------------------------

function getWpBase(): string {
  return (process.env.NEXT_PUBLIC_WP_GRAPHQL_URL ?? '').replace(/\/graphql$/, '');
}

function getInternalKey(): string {
  const key = process.env.HCA_INTERNAL_KEY;
  if (!key) throw new Error('HCA_INTERNAL_KEY env var is not set');
  return key;
}

export async function getCredentials(userId: number): Promise<StoredCredential[]> {
  const wpBase = getWpBase();
  if (!wpBase) return [];
  const res = await fetch(
    `${wpBase}/wp-json/hca/v1/webauthn/credentials?userId=${userId}`,
    { headers: { 'X-HCA-Internal-Key': getInternalKey() } },
  );
  if (!res.ok) return [];
  return (await res.json()) as StoredCredential[];
}

export async function getAllCredentials(): Promise<StoredCredential[]> {
  const wpBase = getWpBase();
  if (!wpBase) return [];
  const res = await fetch(
    `${wpBase}/wp-json/hca/v1/webauthn/credentials`,
    { headers: { 'X-HCA-Internal-Key': getInternalKey() } },
  );
  if (!res.ok) return [];
  return (await res.json()) as StoredCredential[];
}

export async function storeCredential(cred: StoredCredential): Promise<boolean> {
  const wpBase = getWpBase();
  if (!wpBase) return false;
  const res = await fetch(`${wpBase}/wp-json/hca/v1/webauthn/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HCA-Internal-Key': getInternalKey(),
    },
    body: JSON.stringify(cred),
  });
  return res.ok;
}

export async function updateSignCount(credId: string, signCount: number): Promise<void> {
  const wpBase = getWpBase();
  if (!wpBase) return;
  await fetch(`${wpBase}/wp-json/hca/v1/webauthn/credentials/${encodeURIComponent(credId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-HCA-Internal-Key': getInternalKey(),
    },
    body: JSON.stringify({ signCount }),
  });
}

export async function deleteCredential(credId: string): Promise<boolean> {
  const wpBase = getWpBase();
  if (!wpBase) return false;
  const res = await fetch(
    `${wpBase}/wp-json/hca/v1/webauthn/credentials/${encodeURIComponent(credId)}`,
    {
      method: 'DELETE',
      headers: { 'X-HCA-Internal-Key': getInternalKey() },
    },
  );
  return res.ok;
}
