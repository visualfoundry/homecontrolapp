// =============================================================================
// EISY REST client
//
// Wraps the Universal Devices IoX REST API used by each EISY controller.
// All requests use HTTP Basic Auth (shared credentials for all 5 units).
//
// Endpoints used:
//   GET /rest/status              — all node statuses (returns XML)
//   GET /rest/vars/get/1          — integer variables
//   GET /rest/vars/get/2          — state variables
//   GET /rest/nodes/<addr>/cmd/<cmd>[/<val>]  — device command
//   GET /rest/vars/set/<type>/<id>/<val>       — variable command
// =============================================================================

import { XMLParser } from 'fast-xml-parser';
import { EISY_USER, EISY_PASS } from './config.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['node', 'property', 'var'].includes(name),
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${EISY_USER}:${EISY_PASS}`).toString('base64');
}

async function eisyGet(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Authorization: authHeader(), Accept: 'text/xml, application/xml' },
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`EISY GET ${url}: HTTP ${res.status}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// Node status polling
// ---------------------------------------------------------------------------

/** All property values for a single ISY node. Keyed by property id (e.g. "ST"). */
export type NodeProps = Map<string, number>;

/**
 * Fetch all node statuses from one EISY.
 * Returns: nodeAddress → { propertyId → raw integer value }
 *
 * Most devices have one property (ST = on/level).
 * Thermostats have ST + CLISPH + CLISPC + CLIMD.
 */
export async function getNodeStatus(baseUrl: string): Promise<Map<string, NodeProps>> {
  const xml = await eisyGet(`${baseUrl}/rest/status`);
  const parsed = parser.parse(xml) as {
    nodes?: {
      node?: Array<{
        '@_id': string;
        property?: Array<{ '@_id': string; '@_value': string }>;
      }>;
    };
  };

  const result = new Map<string, NodeProps>();
  for (const node of parsed?.nodes?.node ?? []) {
    const id = node['@_id'];
    if (!id) continue;
    const props: NodeProps = new Map();
    for (const p of node.property ?? []) {
      const val = parseInt(p['@_value'], 10);
      if (!isNaN(val)) props.set(p['@_id'], val);
    }
    result.set(id, props);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Variable polling
// ---------------------------------------------------------------------------

/**
 * Fetch all ISY variables of the given type from one EISY.
 * type 1 = integer variables, type 2 = state variables.
 * Returns: variableId → current value
 */
export async function getVariables(
  baseUrl: string,
  type: 1 | 2,
): Promise<Map<number, number>> {
  const xml = await eisyGet(`${baseUrl}/rest/vars/get/${type}`);
  const parsed = parser.parse(xml) as {
    vars?: {
      var?: Array<{ '@_id': string; val?: number | string }>;
    };
  };

  const result = new Map<number, number>();
  for (const v of parsed?.vars?.var ?? []) {
    const id = parseInt(v['@_id'], 10);
    const val = parseInt(String(v.val ?? '0'), 10);
    if (!isNaN(id)) result.set(id, isNaN(val) ? 0 : val);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Send a command to an Insteon node.
 * cmd examples: DON, DOF, DFON, DFOF, CLIMD, CLISPH, CLISPC
 * value: 0–255 for DON (level), or mode/setpoint for thermostat cmds
 */
export async function sendNodeCommand(
  baseUrl: string,
  address: string,
  cmd: string,
  value?: number,
): Promise<void> {
  const encoded = encodeURIComponent(address);
  const url = value !== undefined
    ? `${baseUrl}/rest/nodes/${encoded}/cmd/${cmd}/${value}`
    : `${baseUrl}/rest/nodes/${encoded}/cmd/${cmd}`;
  await eisyGet(url);
}

/**
 * Set an ISY variable value.
 * type 1 = integer, type 2 = state.
 */
export async function setVariable(
  baseUrl: string,
  type: 1 | 2,
  id: number,
  value: number,
): Promise<void> {
  await eisyGet(`${baseUrl}/rest/vars/set/${type}/${id}/${value}`);
}
