// =============================================================================
// UniFi Network client — who is on the Wi-Fi
//
// A phone associated with the house APs is the strongest "home" signal available
// without the phone's cooperation, which is the whole point: no per-device setup,
// and it keeps working with the app closed.
//
// Two API generations are in the wild and which one a console serves depends on
// its firmware, so both are tried and normalised to one shape. node:https is used
// rather than fetch because UniFi consoles present self-signed certificates.
// =============================================================================

import https from 'node:https';
import { getUnifiNetworkConfig } from '@/lib/unifi-config';

export interface NetworkClient {
  mac: string;
  name: string;
  wired: boolean;
  /** Epoch ms the console last saw it, when it says. */
  lastSeen?: number;
  /** UniFi's fingerprint category, when it has one. */
  category?: number;
  /** A phone, tablet or watch — something that leaves the house with a person,
   *  as opposed to a TV, hub or plug that never does. */
  personal: boolean;
}

/** UniFi's fingerprint category for handhelds. Verified against this site: it
 *  covers both phones (dev_family 9) and tablets (10), while laptops sit at 1,
 *  Apple TVs at 47 and smart-home gear at 51. */
const CATEGORY_HANDHELD = 44;

/** Names that read as a personal device. Needed because an unfingerprinted
 *  client has no category at all, and this site's one Android phone is filed
 *  under the smart-home category rather than with the handhelds. */
const PERSONAL_NAME = /iphone|ipad|ipod|pixel|galaxy|android|oneplus|phone|watch/i;

const agent = new https.Agent({ rejectUnauthorized: false });

function get(url: string, apiKey: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        agent,
        headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
        timeout: 10_000,
      },
      res => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function normalise(raw: Record<string, unknown>): NetworkClient | null {
  const mac = String(raw.macAddress ?? raw.mac ?? '').toLowerCase();
  if (!mac) return null;
  const name = String(raw.name ?? raw.hostname ?? raw.display_name ?? mac);
  // The integration API reports a connection type; the classic one an is_wired flag.
  const type = String(raw.type ?? '').toUpperCase();
  const wired = type ? type === 'WIRED' : raw.is_wired === true;
  const seenSeconds = Number(raw.last_seen);
  const seenIso = typeof raw.lastSeen === 'string' ? Date.parse(raw.lastSeen) : NaN;
  const lastSeen = Number.isFinite(seenSeconds) && seenSeconds > 0 ? seenSeconds * 1000
    : Number.isFinite(seenIso) ? seenIso
    : undefined;
  const category = Number.isFinite(Number(raw.dev_cat)) ? Number(raw.dev_cat) : undefined;
  return {
    mac,
    name,
    wired,
    personal: category === CATEGORY_HANDHELD || PERSONAL_NAME.test(name),
    ...(category !== undefined ? { category } : {}),
    ...(lastSeen ? { lastSeen } : {}),
  };
}

/** A name that is really just the MAC teaches nobody anything. */
function isPlaceholderName(client: NetworkClient): boolean {
  const bare = client.name.replace(/[^a-f0-9]/gi, '').toLowerCase();
  return bare === client.mac.replace(/:/g, '');
}

/**
 * Merge the two APIs' views of one client.
 *
 * Neither is strictly better. The classic endpoint carries the UniFi alias and
 * the fingerprint — "Greg's iPhone", category 44 — while the integration endpoint
 * sometimes has a model name for a client the classic one only knows by MAC
 * ("Apple iPad Pro 11 (2nd Gen)"). Taking the best field from each is what makes
 * the picker readable, which is the whole point of showing it to a human.
 */
function merge(classic: NetworkClient[], integration: NetworkClient[]): NetworkClient[] {
  const byMac = new Map(classic.map(c => [c.mac, { ...c }]));
  for (const extra of integration) {
    const existing = byMac.get(extra.mac);
    if (!existing) { byMac.set(extra.mac, extra); continue; }
    if (isPlaceholderName(existing) && !isPlaceholderName(extra)) {
      existing.name = extra.name;
      existing.personal = existing.category === CATEGORY_HANDHELD || PERSONAL_NAME.test(extra.name);
    }
  }
  return [...byMac.values()];
}

function extractList(body: string): Record<string, unknown>[] | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    const obj = parsed as { data?: unknown };
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    return null;
  } catch {
    // An HTML login page means the key was not accepted for this application.
    return null;
  }
}

/**
 * Every client the console currently lists. Empty array when Network isn't
 * configured — a missing key is a setup state, not an error to shout about.
 */
export async function listClients(): Promise<{ clients: NetworkClient[]; error: string | null }> {
  const config = await getUnifiNetworkConfig();
  if (!config) return { clients: [], error: 'UniFi Network host/key not set in HCA Settings' };

  const classic = await fetchClassic(config);
  const integration = await fetchIntegration(config);

  if (classic.length === 0 && integration.length === 0) {
    return { clients: [], error: classicError ?? 'UniFi Network returned no clients' };
  }
  return { clients: merge(classic, integration), error: null };
}

/** Set when the classic endpoint refuses, so the caller can say why. */
let classicError: string | null = null;

async function fetchClassic(config: { host: string; apiKey: string }): Promise<NetworkClient[]> {
  classicError = null;
  try {
    const res = await get(`${config.host}/proxy/network/api/s/default/stat/sta`, config.apiKey);
    const list = extractList(res.body);
    if (res.status === 200 && list) {
      return list.map(normalise).filter((c): c is NetworkClient => c !== null);
    }
    classicError = res.status === 401
      ? 'UniFi Network rejected the API key (is it a Network key, made on the gateway?)'
      : `UniFi Network returned ${res.status}`;
  } catch (err) {
    classicError = err instanceof Error ? err.message : 'UniFi Network unreachable';
  }
  return [];
}

async function fetchIntegration(config: { host: string; apiKey: string }): Promise<NetworkClient[]> {
  try {
    const sites = await get(`${config.host}/proxy/network/integration/v1/sites`, config.apiKey);
    const siteId = extractList(sites.body)?.[0]?.id;
    if (sites.status !== 200 || typeof siteId !== 'string') return [];
    const res = await get(
      `${config.host}/proxy/network/integration/v1/sites/${siteId}/clients?limit=200`,
      config.apiKey,
    );
    const list = extractList(res.body);
    if (res.status === 200 && list) {
      return list.map(normalise).filter((c): c is NetworkClient => c !== null);
    }
  } catch {
    // Optional enrichment — the classic list stands on its own.
  }
  return [];
}
