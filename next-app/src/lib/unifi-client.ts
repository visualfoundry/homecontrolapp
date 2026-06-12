/**
 * Server-side UniFi Protect API client.
 *
 * Uses node:https directly (not undici/fetch) so rejectUnauthorized: false
 * is guaranteed to work regardless of Node.js or undici version. UniFi
 * controllers use self-signed TLS certificates on the local network.
 *
 * Connection credentials come from WP ACF Options via getUnifiConfig().
 */

import https from 'node:https';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { getUnifiConfig } from '@/lib/unifi-config';

export interface UnifiCamera {
  id: string;
  name: string;
  state: 'CONNECTED' | 'DISCONNECTED';
}

export interface UnifiDiag {
  configHost: string | null;
  authMode: 'api-key' | 'cookie' | 'none';
  apiKeyStatus?: number | null;
  apiKeyBody?: string | null;
  loginStatus: number | null;
  loginCookies: string[] | null;
  loginBody: string | null;
  tokenFound: boolean;
  error: string | null;
}

// One agent per process — bypasses self-signed cert, scoped to this module.
const agent = new https.Agent({ rejectUnauthorized: false });

let sessionCookie: string | null = null;

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

function request(
  url: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || '443',
        path: parsed.pathname + parsed.search,
        method: opts.method ?? 'GET',
        headers: opts.headers ?? {},
        agent,
      },
      resolve,
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function readBody(res: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    res.on('data', (chunk: Buffer) => { data += chunk.toString('utf8'); });
    res.on('end', () => resolve(data));
    res.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function login(): Promise<string> {
  const config = await getUnifiConfig();
  if (!config) throw new Error('UniFi not configured');

  const body = JSON.stringify({ username: config.username, password: config.password });
  const res = await request(`${config.host}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) },
    body,
  });

  if (res.statusCode !== 200) {
    const text = await readBody(res);
    console.error(`UniFi login failed: HTTP ${res.statusCode}\nBody: ${text.slice(0, 300)}`);
    throw new Error(`UniFi login failed: ${res.statusCode}`);
  }

  // node:https set-cookie is string[] (one entry per Set-Cookie header)
  const setCookies = (res.headers['set-cookie'] as string[] | undefined) ?? [];
  const tokenEntry = setCookies.find(c => /^TOKEN=/.test(c));
  const token = tokenEntry?.split(';')[0].replace('TOKEN=', '') ?? null;

  if (!token) {
    console.error(`UniFi login: no TOKEN cookie found.\nSet-Cookie: ${setCookies.join(' | ').slice(0, 300)}`);
    throw new Error('UniFi login: no TOKEN cookie in response');
  }

  return token;
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function withAuth(path: string): Promise<IncomingMessage> {
  const config = await getUnifiConfig();
  if (!config) throw new Error('UniFi not configured');

  // API key takes precedence — no session management, no MFA
  if (config.apiKey) {
    return request(`${config.host}${path}`, {
      headers: { 'X-API-Key': config.apiKey },
    });
  }

  // Cookie-based fallback for local (non-SSO) accounts
  if (!sessionCookie) sessionCookie = await login();
  const res = await request(`${config.host}${path}`, {
    headers: { Cookie: `TOKEN=${sessionCookie}` },
  });
  if (res.statusCode === 401) {
    sessionCookie = await login();
    return request(`${config.host}${path}`, {
      headers: { Cookie: `TOKEN=${sessionCookie}` },
    });
  }
  return res;
}

async function unifiGetJson(path: string): Promise<unknown> {
  const res = await withAuth(path);
  const text = await readBody(res);
  if (res.statusCode !== 200) {
    throw new Error(`UniFi GET ${path} failed: ${res.statusCode}`);
  }
  return JSON.parse(text);
}

export async function unifiGetStream(path: string): Promise<{ status: number; contentType: string; stream: ReadableStream }> {
  const res = await withAuth(path);
  return {
    status: res.statusCode ?? 502,
    contentType: (res.headers['content-type'] as string | undefined) ?? 'image/jpeg',
    stream: Readable.toWeb(res) as ReadableStream,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getCameras(): Promise<UnifiCamera[]> {
  const config = await getUnifiConfig();
  const path = config?.apiKey
    ? '/proxy/protect/integration/v1/cameras'
    : '/proxy/protect/api/cameras';
  const data = (await unifiGetJson(path)) as Array<{
    id: string;
    name: string;
    state: string;
  }>;
  return data.map(c => ({
    id: c.id,
    name: c.name,
    state: c.state === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED',
  }));
}

export async function diagnoseUnifi(): Promise<UnifiDiag> {
  const config = await getUnifiConfig();
  if (!config) {
    return {
      configHost: null, authMode: 'none',
      loginStatus: null, loginCookies: null, loginBody: null,
      tokenFound: false, error: 'No config in WP HCA Settings',
    };
  }

  if (config.apiKey) {
    try {
      const res = await request(`${config.host}/proxy/protect/integration/v1/cameras`, {
        headers: { 'X-API-Key': config.apiKey },
      });
      const text = await readBody(res);
      return {
        configHost: config.host,
        authMode: 'api-key',
        apiKeyStatus: res.statusCode ?? null,
        apiKeyBody: text.slice(0, 200),
        loginStatus: null, loginCookies: null, loginBody: null,
        tokenFound: false, error: null,
      };
    } catch (err) {
      return {
        configHost: config.host, authMode: 'api-key',
        apiKeyStatus: null, apiKeyBody: null,
        loginStatus: null, loginCookies: null, loginBody: null,
        tokenFound: false, error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Cookie-based path (local accounts)
  try {
    const body = JSON.stringify({ username: config.username, password: config.password });
    const res = await request(`${config.host}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) },
      body,
    });
    const text = await readBody(res);
    const setCookies = (res.headers['set-cookie'] as string[] | undefined) ?? [];
    const tokenFound = setCookies.some(c => /^TOKEN=/.test(c));
    return {
      configHost: config.host, authMode: 'cookie',
      loginStatus: res.statusCode ?? null,
      loginCookies: setCookies,
      loginBody: text.slice(0, 500),
      tokenFound, error: null,
    };
  } catch (err) {
    return {
      configHost: config.host, authMode: 'cookie',
      loginStatus: null, loginCookies: null, loginBody: null,
      tokenFound: false, error: err instanceof Error ? err.message : String(err),
    };
  }
}
