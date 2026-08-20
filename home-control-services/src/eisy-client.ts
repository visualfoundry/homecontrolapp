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

async function eisyGet(url: string, timeoutMs = 5_000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(),
      Accept: 'text/xml, application/xml',
      Connection: 'close',
    },
    signal: AbortSignal.timeout(timeoutMs),
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
  const xml = await eisyGet(`${baseUrl}/rest/status`, 15_000);
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
 * Issue an ISY-level query to a node — equivalent to the "Query" button in the
 * EISY admin. Forces the ISY to request current status from the physical device
 * and update its database. Use this to re-read battery or sensor state.
 */
/**
 * GET /rest/nodes — full node definitions (address, name, nodeDefId, parent).
 *
 * Distinct from getNodeStatus, which returns live values but no names or tree
 * structure. Used at build time to discover plugin-backed nodes (Harmony) that
 * have no WP control behind them. The payload is large and the EISY serves it
 * slowly, hence the long default timeout.
 */
export interface NodeDefinition {
  address: string;
  name: string;
  nodeDefId: string;
  parent: string | null;
}

export async function getNodeDefinitions(
  baseUrl: string,
  timeoutMs = 90_000,
): Promise<NodeDefinition[]> {
  const xml = await eisyGet(`${baseUrl}/rest/nodes`, timeoutMs);
  const parsed = parser.parse(xml) as {
    nodes?: { node?: Array<Record<string, unknown>> };
  };
  const out: NodeDefinition[] = [];
  for (const n of parsed.nodes?.node ?? []) {
    const address = String(n.address ?? '');
    if (!address) continue;
    const parent = n.parent as { '#text'?: unknown } | string | undefined;
    out.push({
      address,
      name: String(n.name ?? ''),
      nodeDefId: String(n['@_nodeDefId'] ?? ''),
      parent: parent == null
        ? null
        : String(typeof parent === 'object' ? parent['#text'] ?? '' : parent) || null,
    });
  }
  return out;
}

/**
 * GET /rest/profiles — every family's node definitions and editors, as JSON.
 *
 * Plugin node servers publish one nodedef per discovered device, so this is the
 * authoritative answer to "which commands does this node accept".
 */
export async function getProfiles(
  baseUrl: string,
  timeoutMs = 90_000,
): Promise<ProfilesDoc> {
  const text = await eisyGet(`${baseUrl}/rest/profiles`, timeoutMs);
  return JSON.parse(text) as ProfilesDoc;
}

export interface ProfilesDoc {
  families: Array<{
    id: string;
    instances: Array<{
      id: string;
      nodedefs?: Array<{
        id: string;
        cmds?: { accepts?: Array<{ id: string; parameters?: Array<{ editor?: string }> }> };
      }>;
      /** Command parameter value lists. A plugin publishes one per device, which
       *  is how "which buttons does this box actually have" is discoverable. */
      editors?: Array<{
        id: string;
        ranges?: Array<{
          /** Indexes this editor allows, e.g. "0-4,21-24,77,168-174". */
          subset?: string;
          /** index → name, over the editor's full table (not just the subset). */
          names?: Record<string, string>;
        }>;
      }>;
    }>;
  }>;
}

export async function queryNode(baseUrl: string, address: string): Promise<void> {
  const encoded = encodeURIComponent(address);
  await eisyGet(`${baseUrl}/rest/nodes/${encoded}/query`);
}

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
