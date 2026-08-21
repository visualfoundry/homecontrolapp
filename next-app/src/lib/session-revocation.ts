// =============================================================================
// Session revocation — per-user epochs from WordPress
//
// The session cookie is a stateless HMAC, so an issued one cannot be withdrawn
// by its own rules. WP holds a per-user epoch ("reject app sessions issued
// before this"), bumped by the "Sign out app" action on the Users screen, and a
// session whose issued-at predates its user's epoch is refused here.
//
// Two paths keep this cache honest:
//   — WP pushes the bump to /api/auth/revoke, so a sign-out lands immediately.
//   — A pull from WP with a short TTL, which covers a missed push and a restart
//     of this process (the cache is in memory; WP is the record).
//
// Deliberately fails open. If WP is unreachable the last known epochs stand
// rather than locking the house out of its own light switches over an admin
// action that may never have been taken.
// =============================================================================

const TTL_MS = 60_000;

interface EpochCache {
  epochs: Map<number, number>;
  fetchedAt: number;
  inFlight: Promise<void> | null;
}

// Module scope survives between requests in the Node runtime; a cold start just
// re-pulls from WP.
const cache: EpochCache = { epochs: new Map(), fetchedAt: 0, inFlight: null };

function wpBase(): string {
  return (process.env.NEXT_PUBLIC_WP_GRAPHQL_URL ?? '').replace(/\/graphql$/, '');
}

async function pull(): Promise<void> {
  const base = wpBase();
  const key = process.env.HCA_INTERNAL_KEY;
  if (!base || !key) return;
  try {
    const res = await fetch(`${base}/wp-json/hca/v1/session-epochs`, {
      headers: { 'X-HCA-Internal-Key': key },
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return;
    const data = await res.json() as Record<string, number>;
    const next = new Map<number, number>();
    for (const [id, epoch] of Object.entries(data)) {
      const userId = parseInt(id, 10);
      if (userId && epoch > 0) next.set(userId, epoch);
    }
    cache.epochs = next;
    cache.fetchedAt = Date.now();
  } catch {
    // Unreachable — keep what we have (see "fails open" above).
  }
}

/** Refresh past the TTL, collapsing concurrent callers onto one request. */
async function ensureFresh(): Promise<void> {
  if (Date.now() - cache.fetchedAt < TTL_MS) return;
  if (!cache.inFlight) {
    cache.inFlight = pull().finally(() => { cache.inFlight = null; });
  }
  await cache.inFlight;
}

/** Record a bump pushed by WP, so it applies without waiting for the TTL. */
export function setEpoch(userId: number, epoch: number): void {
  if (!userId || !epoch) return;
  const current = cache.epochs.get(userId) ?? 0;
  if (epoch > current) cache.epochs.set(userId, epoch);
}

/** True when this session was issued before its user was signed out. */
export async function isRevoked(userId: number, issuedAt: number): Promise<boolean> {
  await ensureFresh();
  const epoch = cache.epochs.get(userId);
  if (epoch === undefined) return false;
  // `<` not `<=`: a session minted in the same second as the bump is the user
  // signing straight back in, which is allowed.
  return issuedAt < epoch;
}
