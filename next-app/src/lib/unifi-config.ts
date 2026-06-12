/**
 * Fetches UniFi Protect connection credentials from the WordPress HCA Settings
 * Options page (stored as ACF fields). Results are cached in memory for 1 hour
 * so the WP REST call doesn't happen on every camera request.
 *
 * The WP endpoint is GET /wp-json/hca/v1/settings, protected by HCA_INTERNAL_KEY.
 */

export interface UnifiConfig {
  host: string;
  username: string;
  password: string;
  apiKey?: string;
}

let cached: UnifiConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getUnifiConfig(): Promise<UnifiConfig | null> {
  if (cached && Date.now() < cacheExpiry) return cached;

  const internalKey = process.env.HCA_INTERNAL_KEY;
  if (!internalKey) return null;

  const wpBase = (process.env.NEXT_PUBLIC_WP_GRAPHQL_URL ?? '').replace(/\/graphql$/, '');
  if (!wpBase) return null;

  let res: Response;
  try {
    res = await fetch(`${wpBase}/wp-json/hca/v1/settings`, {
      headers: { 'X-HCA-Internal-Key': internalKey },
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const data = (await res.json()) as {
    unifi_protect_host: string;
    unifi_protect_username: string;
    unifi_protect_password: string;
    unifi_api_key: string;
  };

  if (!data.unifi_protect_host) return null;

  const rawHost = data.unifi_protect_host;
  const normalized = new URL(rawHost.startsWith('http') ? rawHost : `https://${rawHost}`);
  const config: UnifiConfig = {
    host: `${normalized.protocol}//${normalized.host}`,
    username: data.unifi_protect_username,
    password: data.unifi_protect_password,
    apiKey: data.unifi_api_key || undefined,
  };

  cached = config;
  cacheExpiry = Date.now() + CACHE_TTL;
  return config;
}

/** Call this to force the next request to re-fetch credentials from WP. */
export function invalidateUnifiConfig(): void {
  cached = null;
  cacheExpiry = 0;
}
