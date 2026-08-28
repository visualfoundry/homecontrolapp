// =============================================================================
// Hue bridge emulation — lets a Harmony remote drive EISY variables
//
// A Harmony hub only speaks IP to a short list of smart-home platforms, and
// Universal Devices is not one of them — which is why the house had a
// "Universal Devices Light Controller" registered as an *IR* device, and why
// none of the `IR …` programs on the lighting EISYs have ever fired: the eisy
// has no IR receiver. Philips Hue is on Harmony's list and speaks a documented
// local protocol, so this presents itself as a Hue bridge.
//
// The point of the exercise is the last line of each mapping: a Home Control
// button press on the remote ends up as `GET /rest/vars/set/2/201/1` on an
// EISY. Nothing physical is driven from here — the room's own programs already
// know what to do when their step variable moves.
//
//   Harmony remote → hub → SSDP + HTTP (here) → EISY variable → EISY programs
//
// Two halves:
//   * SSDP  — answers the hub's M-SEARCH so it can find us at all.
//   * HTTP  — the subset of the Hue v1 API a hub actually calls.
// =============================================================================

import express, { type Request, type Response } from 'express';
import dgram from 'node:dgram';
import { networkInterfaces } from 'node:os';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EISY_URLS, HUE_PORT, HUE_HOST_IP } from './config.js';
import { getVariables, setVariable } from './eisy-client.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface HueLightConfig {
  /** Hue light id — what the hub addresses. Stable; don't renumber. */
  id: number;
  name: string;
  /** Index into EISY_URLS. */
  eisy: number;
  varType: 1 | 2;
  varId: number;
  /** Top of the step scale. 0 is always off, so Cinema (0/1/2) has steps: 2. */
  steps: number;
}

function loadLights(): HueLightConfig[] {
  const path = join(ROOT, 'hue-lights.json');
  if (!existsSync(path)) return [];
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8')) as { lights?: HueLightConfig[] };
    return (doc.lights ?? []).filter(l => EISY_URLS[l.eisy] !== undefined);
  } catch (e) {
    console.error('[hue] hue-lights.json is not valid JSON — no lights exposed:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Bridge identity
//
// A hub decides whether it is talking to a real bridge from these strings, so
// they mimic a 2015-era Hue bridge (BSB002) down to the Philips OUI. The host
// half of the MAC is derived from this machine's own so it stays put across
// restarts — a bridge whose id changes looks like a *different* bridge, and the
// hub would need re-pairing every time the service restarted.
// ---------------------------------------------------------------------------

function lanIp(): string {
  if (HUE_HOST_IP) return HUE_HOST_IP;
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return '127.0.0.1';
}

function hostSuffix(): string {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal && a.mac && a.mac !== '00:00:00:00:00:00') {
        return a.mac.replace(/:/g, '').slice(-6).toLowerCase();
      }
    }
  }
  return '000001';
}

const IP = lanIp();
const SUFFIX = hostSuffix();
/** Philips OUI + this host — what a real bridge would report. */
const MAC = `00:17:88:${SUFFIX.slice(0, 2)}:${SUFFIX.slice(2, 4)}:${SUFFIX.slice(4, 6)}`;
const BRIDGE_ID = `001788FFFE${SUFFIX}`.toUpperCase();
const UUID = `2f402f80-da50-11e1-9b23-${MAC.replace(/:/g, '')}`;

// ---------------------------------------------------------------------------
// Pairing
//
// A real bridge only hands out an API key while its physical link button is
// held down. There is no button here, so `POST /hue/link` on the main service
// opens the same window. Keys are persisted so a restart doesn't un-pair the
// hub.
// ---------------------------------------------------------------------------

const LINK_WINDOW_MS = 300_000;
const STATE_FILE = join(ROOT, 'hue-state.json');

interface HueState { users: string[] }

function loadState(): HueState {
  if (!existsSync(STATE_FILE)) return { users: [] };
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as HueState;
    return { users: Array.isArray(s.users) ? s.users : [] };
  } catch { return { users: [] }; }
}

function saveState(s: HueState): void {
  try { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }
  catch (e) { console.error('[hue] could not persist pairing state:', e); }
}

let state = loadState();
let linkUntil = 0;

/** Open the pairing window. Called from the main service's /hue/link. */
export function openLinkWindow(): number {
  linkUntil = Date.now() + LINK_WINDOW_MS;
  console.log(`[hue] link window open for ${LINK_WINDOW_MS / 1000}s — pair the hub now`);
  return LINK_WINDOW_MS;
}

export function linkStatus(): { open: boolean; msLeft: number; pairedClients: number } {
  const msLeft = Math.max(0, linkUntil - Date.now());
  return { open: msLeft > 0, msLeft, pairedClients: state.users.length };
}

function newUsername(): string {
  let s = '';
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ---------------------------------------------------------------------------
// Level mapping
//
// Hue brightness is 1–254; an EISY step scale is 0–steps. `bri_inc` is the
// interesting one: a Home Control brightness key sends a relative nudge, and
// one press should move exactly one step rather than some fraction of one.
// ---------------------------------------------------------------------------

function stepToBri(value: number, steps: number): number {
  if (value <= 0) return 1;
  return Math.max(1, Math.min(254, Math.round((value / steps) * 254)));
}

function briToStep(bri: number, steps: number): number {
  const v = Math.round((Math.max(0, Math.min(254, bri)) / 254) * steps);
  return Math.max(1, Math.min(steps, v)); // a `bri` write is never "off"
}

// ---------------------------------------------------------------------------
// Live values
//
// Read through to the EISY rather than trusting a local mirror, so the hub sees
// the level even when something else moved it. Cached briefly because a hub can
// poll all its lights in a burst.
// ---------------------------------------------------------------------------

const CACHE_MS = 4_000;
const cache = new Map<string, { at: number; vars: Map<number, number> }>();

async function readVar(light: HueLightConfig): Promise<number> {
  const key = `${light.eisy}:${light.varType}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.vars.get(light.varId) ?? 0;
  try {
    const vars = await getVariables(EISY_URLS[light.eisy]!, light.varType);
    cache.set(key, { at: Date.now(), vars });
    return vars.get(light.varId) ?? 0;
  } catch {
    return hit?.vars.get(light.varId) ?? 0;
  }
}

/** Drop the cache for one EISY so the next read reflects a write we just made. */
function invalidate(light: HueLightConfig): void {
  cache.delete(`${light.eisy}:${light.varType}`);
}

/** Last non-zero level per light, so `on: true` with no brightness restores. */
const lastOn = new Map<number, number>();

async function lightJson(light: HueLightConfig): Promise<unknown> {
  const value = await readVar(light);
  if (value > 0) lastOn.set(light.id, value);
  return {
    state: {
      on: value > 0,
      bri: stepToBri(value, light.steps),
      alert: 'none',
      mode: 'homeautomation',
      reachable: true,
    },
    swupdate: { state: 'noupdates', lastinstall: null },
    type: 'Dimmable light',
    name: light.name,
    modelid: 'LWB010',
    manufacturername: 'Philips',
    productname: 'Hue white lamp',
    uniqueid: `${MAC}-${String(light.id).padStart(2, '0')}`,
    swversion: '1.55.8_r28815',
  };
}

// ---------------------------------------------------------------------------
// HTTP — the slice of the Hue v1 API a hub actually calls
// ---------------------------------------------------------------------------

function bridgeConfig(full: boolean): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: 'Home Control Bridge',
    datastoreversion: '103',
    swversion: '1955082050',
    apiversion: '1.55.0',
    mac: MAC,
    bridgeid: BRIDGE_ID,
    factorynew: false,
    replacesbridgeid: null,
    modelid: 'BSB002',
    starterkitid: '',
  };
  if (!full) return base;
  return {
    ...base,
    zigbeechannel: 25,
    dhcp: true,
    ipaddress: IP,
    netmask: '255.255.255.0',
    gateway: IP.replace(/\.\d+$/, '.1'),
    proxyaddress: 'none',
    proxyport: 0,
    UTC: new Date().toISOString().replace(/\.\d+Z$/, ''),
    localtime: new Date().toISOString().replace(/\.\d+Z$/, ''),
    timezone: 'Etc/GMT',
    linkbutton: linkStatus().open,
    portalservices: false,
    portalconnection: 'disconnected',
    whitelist: Object.fromEntries(
      state.users.map(u => [u, {
        'last use date': new Date().toISOString().replace(/\.\d+Z$/, ''),
        'create date': new Date().toISOString().replace(/\.\d+Z$/, ''),
        name: 'harmony',
      }]),
    ),
  };
}

const DESCRIPTION = () => `<?xml version="1.0" encoding="UTF-8" ?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
<specVersion><major>1</major><minor>0</minor></specVersion>
<URLBase>http://${IP}:${HUE_PORT}/</URLBase>
<device>
<deviceType>urn:schemas-upnp-org:device:Basic:1</deviceType>
<friendlyName>Home Control Bridge (${IP})</friendlyName>
<manufacturer>Royal Philips Electronics</manufacturer>
<manufacturerURL>http://www.philips.com</manufacturerURL>
<modelDescription>Philips hue Personal Wireless Lighting</modelDescription>
<modelName>Philips hue bridge 2015</modelName>
<modelNumber>BSB002</modelNumber>
<modelURL>http://www.meethue.com</modelURL>
<serialNumber>${MAC.replace(/:/g, '')}</serialNumber>
<UDN>uuid:${UUID}</UDN>
<presentationURL>index.html</presentationURL>
</device>
</root>`;

export function startHueBridge(): void {
  const lights = loadLights();
  if (lights.length === 0) {
    console.log('[hue] no lights configured — bridge not started');
    return;
  }
  const byId = new Map(lights.map(l => [l.id, l]));

  const app = express();
  app.use(express.json({ type: () => true }));

  // Hub chatter is the only way to see what it actually sends, and the shape of
  // a brightness key press is the thing most likely to need tuning.
  app.use((req, _res, next) => {
    if (req.method !== 'GET') {
      console.log(`[hue] ${req.method} ${req.path} ${JSON.stringify(req.body ?? {})}`);
    }
    next();
  });

  app.get('/description.xml', (_req, res) => {
    res.type('application/xml').send(DESCRIPTION());
  });

  // Pairing. A hub posts here repeatedly while telling the user to press the
  // button; the 101 error is what makes it keep asking rather than give up.
  app.post('/api', (req: Request, res: Response) => {
    if (!linkStatus().open) {
      res.json([{ error: { type: 101, address: '', description: 'link button not pressed' } }]);
      return;
    }
    const username = newUsername();
    state.users.push(username);
    saveState(state);
    console.log(`[hue] paired a new client (${state.users.length} total)`);
    res.json([{ success: { username, clientkey: '0'.repeat(32) } }]);
  });

  // Unauthenticated config — used for discovery, and by clients checking that a
  // bridge is really at this address before they try to pair.
  app.get('/api/config', (_req, res) => { res.json(bridgeConfig(false)); });

  app.get('/api/:user/config', (_req, res) => { res.json(bridgeConfig(true)); });

  app.get('/api/:user/lights', async (_req, res) => {
    const out: Record<string, unknown> = {};
    for (const l of lights) out[String(l.id)] = await lightJson(l);
    res.json(out);
  });

  app.get('/api/:user/lights/:id', async (req, res) => {
    const light = byId.get(Number(req.params.id));
    if (!light) { res.json([{ error: { type: 3, address: `/lights/${req.params.id}`, description: 'resource, /lights, not available' } }]); return; }
    res.json(await lightJson(light));
  });

  // The whole datastore. Some clients fetch this once instead of /lights.
  app.get('/api/:user', async (_req, res) => {
    const out: Record<string, unknown> = {};
    for (const l of lights) out[String(l.id)] = await lightJson(l);
    res.json({ lights: out, groups: {}, config: bridgeConfig(true), scenes: {}, schedules: {}, rules: {}, sensors: {} });
  });

  app.get('/api/:user/groups', (_req, res) => { res.json({}); });
  app.get('/api/:user/scenes', (_req, res) => { res.json({}); });
  app.get('/api/:user/schedules', (_req, res) => { res.json({}); });
  app.get('/api/:user/sensors', (_req, res) => { res.json({}); });

  // The one that matters — a button press lands here.
  app.put('/api/:user/lights/:id/state', async (req, res) => {
    const light = byId.get(Number(req.params.id));
    if (!light) { res.json([{ error: { type: 3, address: `/lights/${req.params.id}`, description: 'resource, /lights, not available' } }]); return; }

    const body = (req.body ?? {}) as { on?: boolean; bri?: number; bri_inc?: number };
    const current = await readVar(light);
    let next = current;

    if (typeof body.bri_inc === 'number') {
      // One press, one step — the whole reason a relative nudge is worth
      // handling separately from an absolute level.
      next = current + (body.bri_inc >= 0 ? 1 : -1);
    } else if (typeof body.bri === 'number') {
      next = briToStep(body.bri, light.steps);
    }

    if (body.on === false) next = 0;
    else if (body.on === true && body.bri === undefined && body.bri_inc === undefined) {
      next = lastOn.get(light.id) ?? light.steps;
    }

    next = Math.max(0, Math.min(light.steps, next));

    const replies: unknown[] = [];
    if (next !== current) {
      try {
        await setVariable(EISY_URLS[light.eisy]!, light.varType, light.varId, next);
        invalidate(light);
        if (next > 0) lastOn.set(light.id, next);
        console.log(`[hue] ${light.name}: ${current} → ${next} (eisy${light.eisy} var ${light.varType}/${light.varId})`);
      } catch (e) {
        console.error(`[hue] ${light.name}: variable write failed:`, e);
        res.json([{ error: { type: 901, address: `/lights/${light.id}/state`, description: 'internal error' } }]);
        return;
      }
    }

    const base = `/lights/${light.id}/state`;
    replies.push({ success: { [`${base}/on`]: next > 0 } });
    replies.push({ success: { [`${base}/bri`]: stepToBri(next, light.steps) } });
    res.json(replies);
  });

  // A hub that gets a 404 mid-conversation can decide the bridge is gone, so
  // unknown API paths answer in Hue's own error shape instead.
  app.use('/api', (req: Request, res: Response) => {
    res.json([{ error: { type: 3, address: req.path, description: 'resource not available' } }]);
  });

  app.listen(HUE_PORT, () => {
    console.log(`[hue] bridge listening on http://${IP}:${HUE_PORT}  id=${BRIDGE_ID}  mac=${MAC}`);
    console.log(`[hue] exposing ${lights.length} light(s): ${lights.map(l => l.name).join(', ')}`);
    if (state.users.length === 0) console.log('[hue] no paired clients yet — POST /hue/link on the main port, then add the bridge in the Harmony app');
  });

  startSsdp();
}

// ---------------------------------------------------------------------------
// SSDP
//
// The hub finds a bridge by multicasting M-SEARCH and reading the LOCATION out
// of the reply. Nothing here is Hue-specific except `hue-bridgeid`, which is
// what tells a Hue-aware client this is worth talking to.
// ---------------------------------------------------------------------------

const SSDP_ADDR = '239.255.255.250';
const SSDP_PORT = 1900;

const MATCHING_ST = new Set([
  'ssdp:all',
  'upnp:rootdevice',
  'urn:schemas-upnp-org:device:basic:1',
  'libhue:idl',
]);

function ssdpReply(st: string): Buffer {
  return Buffer.from(
    'HTTP/1.1 200 OK\r\n' +
    `HOST: ${SSDP_ADDR}:${SSDP_PORT}\r\n` +
    'EXT:\r\n' +
    'CACHE-CONTROL: max-age=100\r\n' +
    `LOCATION: http://${IP}:${HUE_PORT}/description.xml\r\n` +
    'SERVER: Linux/3.14.0 UPnP/1.0 IpBridge/1.55.0\r\n' +
    `hue-bridgeid: ${BRIDGE_ID}\r\n` +
    `ST: ${st}\r\n` +
    `USN: uuid:${UUID}::${st === 'ssdp:all' ? 'upnp:rootdevice' : st}\r\n` +
    '\r\n',
  );
}

const SEARCH_LOG_MS = 60_000;
const seenSearch = new Map<string, number>();

/** Log an inbound M-SEARCH, at most once a minute per source and target. */
function noteSearch(ip: string, st: string, matched: boolean): void {
  const key = `${ip}|${st}`;
  const now = Date.now();
  if (now - (seenSearch.get(key) ?? 0) < SEARCH_LOG_MS) return;
  seenSearch.set(key, now);
  console.log(`[hue] M-SEARCH from ${ip} ST=${st || '(none)'} -> ${matched ? 'replied' : 'ignored'}`);
}

function startSsdp(): void {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  sock.on('error', (e) => {
    console.error('[hue] SSDP socket error — discovery will not work:', e.message);
  });

  sock.on('message', (msg, rinfo) => {
    const text = msg.toString('utf8');
    if (!text.startsWith('M-SEARCH')) return;
    const st = (/^ST:[ \t]*(.+)$/im.exec(text)?.[1] ?? '').trim().toLowerCase();
    const matched = MATCHING_ST.has(st);
    noteSearch(rinfo.address, st, matched);
    if (!matched) return;

    // Real bridges answer more than once — the multicast reply is cheap and UDP
    // loss during a hub's discovery burst is common.
    const reply = ssdpReply(st === 'ssdp:all' ? 'upnp:rootdevice' : st);
    for (const delay of [0, 120, 350]) {
      setTimeout(() => {
        sock.send(reply, rinfo.port, rinfo.address, (err) => {
          if (err) console.error('[hue] SSDP reply failed:', err.message);
        });
      }, delay);
    }
  });

  sock.bind(SSDP_PORT, () => {
    try {
      sock.addMembership(SSDP_ADDR);
      sock.setBroadcast(true);
      console.log(`[hue] SSDP listening on ${SSDP_ADDR}:${SSDP_PORT}`);
    } catch (e) {
      console.error('[hue] could not join the SSDP multicast group:', e);
    }
  });

  // Unsolicited announcements, so a hub that is not actively searching still
  // learns we exist.
  const notify = (): void => {
    const msg = Buffer.from(
      'NOTIFY * HTTP/1.1\r\n' +
      `HOST: ${SSDP_ADDR}:${SSDP_PORT}\r\n` +
      'CACHE-CONTROL: max-age=100\r\n' +
      `LOCATION: http://${IP}:${HUE_PORT}/description.xml\r\n` +
      'SERVER: Linux/3.14.0 UPnP/1.0 IpBridge/1.55.0\r\n' +
      'NTS: ssdp:alive\r\n' +
      `hue-bridgeid: ${BRIDGE_ID}\r\n` +
      'NT: upnp:rootdevice\r\n' +
      `USN: uuid:${UUID}::upnp:rootdevice\r\n` +
      '\r\n',
    );
    sock.send(msg, SSDP_PORT, SSDP_ADDR, () => { /* best effort */ });
  };
  setInterval(notify, 60_000).unref();
  setTimeout(notify, 2_000);
}
