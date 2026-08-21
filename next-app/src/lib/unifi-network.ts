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
}

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
  return { mac, name, wired, ...(lastSeen ? { lastSeen } : {}) };
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

  // Newer consoles: the integration API, which needs the site id first.
  try {
    const sites = await get(`${config.host}/proxy/network/integration/v1/sites`, config.apiKey);
    const siteList = extractList(sites.body);
    const siteId = siteList?.[0]?.id;
    if (sites.status === 200 && typeof siteId === 'string') {
      const res = await get(
        `${config.host}/proxy/network/integration/v1/sites/${siteId}/clients?limit=200`,
        config.apiKey,
      );
      const list = extractList(res.body);
      if (res.status === 200 && list) {
        return { clients: list.map(normalise).filter((c): c is NetworkClient => c !== null), error: null };
      }
    }
  } catch {
    // Fall through to the classic endpoint.
  }

  // Older consoles: the classic stat/sta endpoint.
  try {
    const res = await get(`${config.host}/proxy/network/api/s/default/stat/sta`, config.apiKey);
    const list = extractList(res.body);
    if (res.status === 200 && list) {
      return { clients: list.map(normalise).filter((c): c is NetworkClient => c !== null), error: null };
    }
    return {
      clients: [],
      error: res.status === 401
        ? 'UniFi Network rejected the API key (is it a Network key, made on the gateway?)'
        : `UniFi Network returned ${res.status}`,
    };
  } catch (err) {
    return { clients: [], error: err instanceof Error ? err.message : 'UniFi Network unreachable' };
  }
}
