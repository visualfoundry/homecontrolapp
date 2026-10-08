// =============================================================================
// Zigbee presence → EISY variables
//
// Zigbee2MQTT (PM2 `hca-zigbee`, same host) owns the Sonoff coordinator and
// publishes each device's state to `zigbee2mqtt/<friendly name>`. This module
// subscribes, and for every sensor listed in zigbee-sensors.json mirrors its
// `presence` onto an EISY variable — the same variable the room's Insteon motion
// programs already drive, so existing EISY logic acts on it unchanged.
//
// It also patches `zigbee/<ieee>` into the state store, so presence and link
// quality are visible on /state and /stream.
//
// Write rules:
//   * presence on  → write 1, on every rising edge (including the first report
//     after this service starts).
//   * presence off → write 0, but only after this service has itself seen the
//     sensor go on. Zigbee2MQTT doesn't retain state, so the first message after
//     a restart says nothing about who set the variable last; writing 0 then
//     would switch off lights an Insteon sensor had just turned on.
//   * Unchanged reports write nothing — the FP1E reports linkquality and
//     target_distance far more often than presence changes.
// =============================================================================

import mqtt from 'mqtt';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EISY_URLS, MQTT_URL, ZIGBEE_BASE_TOPIC } from './config.js';
import { setVariable } from './eisy-client.js';
import { applyPatch } from './state-store.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SENSORS_FILE = join(HERE, '..', 'zigbee-sensors.json');

interface ZigbeeSensor {
  ieee: string;
  name: string;
  eisy: number;
  varType: 1 | 2;
  varId: number;
}

function loadSensors(): ZigbeeSensor[] {
  if (!existsSync(SENSORS_FILE)) return [];
  const raw = JSON.parse(readFileSync(SENSORS_FILE, 'utf8')) as { sensors?: ZigbeeSensor[] };
  return (raw.sensors ?? []).filter(s => EISY_URLS[s.eisy] !== undefined);
}

const WRITE_ATTEMPTS = 3;
const RETRY_MS = 2_000;

export function startZigbee(): void {
  const sensors = loadSensors();
  if (sensors.length === 0) {
    console.log('[zigbee] no sensors configured — not started');
    return;
  }
  const byIeee = new Map(sensors.map(s => [s.ieee.toLowerCase(), s]));

  /** friendly name → IEEE, from Z2M's retained bridge/devices list. */
  const ieeeByName = new Map<string, string>();
  /** Last presence this service saw per sensor; absent until the first report. */
  const lastPresence = new Map<string, boolean>();
  /** Bumped per sensor on each new target value, so a stale retry gives up. */
  const writeSeq = new Map<string, number>();

  async function writeVar(sensor: ZigbeeSensor, value: 0 | 1): Promise<void> {
    const seq = (writeSeq.get(sensor.ieee) ?? 0) + 1;
    writeSeq.set(sensor.ieee, seq);
    for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt++) {
      if (writeSeq.get(sensor.ieee) !== seq) return; // superseded by a newer reading
      try {
        await setVariable(EISY_URLS[sensor.eisy]!, sensor.varType, sensor.varId, value);
        console.log(`[zigbee] ${sensor.name}: presence ${value ? 'on' : 'off'} → eisy${sensor.eisy} var ${sensor.varType}/${sensor.varId} = ${value}`);
        return;
      } catch (e) {
        console.error(`[zigbee] ${sensor.name}: variable write failed (attempt ${attempt}/${WRITE_ATTEMPTS}):`, e);
        if (attempt < WRITE_ATTEMPTS) await new Promise(r => setTimeout(r, RETRY_MS));
      }
    }
  }

  function onDeviceState(ieee: string, payload: Record<string, unknown>): void {
    const linkquality = typeof payload.linkquality === 'number' ? payload.linkquality : undefined;
    const presence = typeof payload.presence === 'boolean' ? payload.presence : undefined;

    const patch: Record<string, unknown> = {};
    if (presence !== undefined) patch.presence = presence;
    if (linkquality !== undefined) patch.linkquality = linkquality;
    if (Object.keys(patch).length) applyPatch(`zigbee/${ieee}`, patch);

    const sensor = byIeee.get(ieee);
    if (!sensor || presence === undefined) return;
    const prev = lastPresence.get(ieee);
    lastPresence.set(ieee, presence);
    if (prev === presence) return;
    if (presence) void writeVar(sensor, 1);
    else if (prev === true) void writeVar(sensor, 0);
  }

  const client = mqtt.connect(MQTT_URL, { reconnectPeriod: 5_000 });
  const devicesTopic = `${ZIGBEE_BASE_TOPIC}/bridge/devices`;

  client.on('connect', () => {
    console.log(`[zigbee] connected to ${MQTT_URL}; watching ${sensors.length} sensor(s)`);
    client.subscribe(`${ZIGBEE_BASE_TOPIC}/#`);
  });
  client.on('error', e => console.error('[zigbee] mqtt error:', e.message));

  client.on('message', (topic, buf) => {
    if (topic === devicesTopic) {
      try {
        const devices = JSON.parse(buf.toString()) as { ieee_address?: string; friendly_name?: string }[];
        ieeeByName.clear();
        for (const d of devices) {
          if (d.ieee_address && d.friendly_name) ieeeByName.set(d.friendly_name, d.ieee_address.toLowerCase());
        }
      } catch (e) {
        console.error('[zigbee] bad bridge/devices payload:', e);
      }
      return;
    }

    const name = topic.slice(ZIGBEE_BASE_TOPIC.length + 1);
    if (!name || name.startsWith('bridge/') || name.endsWith('/availability') || name.endsWith('/set') || name.endsWith('/get')) return;
    const ieee = ieeeByName.get(name);
    if (!ieee) return;

    let payload: unknown;
    try {
      payload = JSON.parse(buf.toString());
    } catch {
      return;
    }
    if (payload && typeof payload === 'object') onDeviceState(ieee, payload as Record<string, unknown>);
  });
}
