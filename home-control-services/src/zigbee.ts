// =============================================================================
// Zigbee presence → EISY variables
//
// Zigbee2MQTT (PM2 `hca-zigbee`, same host) owns the Sonoff coordinator and
// publishes each device's state to `zigbee2mqtt/<friendly name>`. This module
// subscribes and, for every space in zigbee-sensors.json, keeps one EISY
// presence variable equal to "is anyone in this space":
//
//   1 while ANY of the space's sensors reports presence,
//   0 once ALL of them report clear.
//
// So a large room can have several sensors and the EISY still sees a single
// variable; its programs don't change with the sensor count. The variable is
// this service's alone — the room's lights/motion variables stay with the EISY
// programs, which trigger on this one.
//
// Write rules:
//   * Writes only when the space's combined value differs from what this service
//     last wrote, so the FP1E's frequent linkquality/target_distance reports
//     cost the EISY nothing.
//   * Before the first write after startup, every sensor in the space must have
//     reported — unless one already reports presence, which settles it. Z2M
//     doesn't retain state, so on connect each sensor is asked for its presence.
//
// Each sensor (`zigbee/<ieee>`) and space (`zigbee/space/<key>`) is also patched
// into the state store, so presence and link quality show on /state and /stream.
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

interface PresenceSpace {
  key: string;
  name: string;
  eisy: number;
  varType: 1 | 2;
  varId: number;
  /** IEEE addresses of the presence sensors covering this space. */
  sensors: string[];
}

function loadSpaces(): PresenceSpace[] {
  if (!existsSync(SENSORS_FILE)) return [];
  const raw = JSON.parse(readFileSync(SENSORS_FILE, 'utf8')) as { spaces?: PresenceSpace[] };
  return (raw.spaces ?? [])
    .filter(s => EISY_URLS[s.eisy] !== undefined && s.sensors.length > 0)
    .map(s => ({ ...s, sensors: s.sensors.map(i => i.toLowerCase()) }));
}

const WRITE_ATTEMPTS = 3;
const RETRY_MS = 2_000;

export function startZigbee(): void {
  const spaces = loadSpaces();
  if (spaces.length === 0) {
    console.log('[zigbee] no presence spaces configured — not started');
    return;
  }

  /** sensor IEEE → the spaces it covers (one sensor may sit between two). */
  const spacesBySensor = new Map<string, PresenceSpace[]>();
  for (const space of spaces) {
    for (const ieee of space.sensors) {
      spacesBySensor.set(ieee, [...(spacesBySensor.get(ieee) ?? []), space]);
    }
  }

  /** friendly name → IEEE, and back, from Z2M's retained bridge/devices list. */
  const ieeeByName = new Map<string, string>();
  const nameByIeee = new Map<string, string>();
  /** Latest presence per sensor; absent until it first reports. */
  const presenceBySensor = new Map<string, boolean>();
  /** Value this service last wrote (or is writing) per space. */
  const written = new Map<string, 0 | 1>();
  /** Bumped per space on each new target value, so a stale retry gives up. */
  const writeSeq = new Map<string, number>();

  async function writeVar(space: PresenceSpace, value: 0 | 1): Promise<void> {
    const seq = (writeSeq.get(space.key) ?? 0) + 1;
    writeSeq.set(space.key, seq);
    for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt++) {
      if (writeSeq.get(space.key) !== seq) return; // superseded by a newer value
      try {
        await setVariable(EISY_URLS[space.eisy]!, space.varType, space.varId, value);
        console.log(`[zigbee] ${space.name}: ${value ? 'occupied' : 'clear'} → eisy${space.eisy} var ${space.varType}/${space.varId} = ${value}`);
        return;
      } catch (e) {
        console.error(`[zigbee] ${space.name}: variable write failed (attempt ${attempt}/${WRITE_ATTEMPTS}):`, e);
        if (attempt < WRITE_ATTEMPTS) await new Promise(r => setTimeout(r, RETRY_MS));
      }
    }
    // Every attempt failed: forget the value so the next sensor report retries.
    if (writeSeq.get(space.key) === seq) written.delete(space.key);
  }

  function evaluate(space: PresenceSpace): void {
    const readings = space.sensors.map(i => presenceBySensor.get(i));
    let value: 0 | 1;
    if (readings.some(r => r === true)) value = 1;
    else if (readings.every(r => r === false)) value = 0;
    else return; // a sensor hasn't reported yet and none sees anyone — undecided

    applyPatch(`zigbee/space/${space.key}`, { presence: value === 1 });
    if (written.get(space.key) === value) return;
    written.set(space.key, value);
    void writeVar(space, value);
  }

  function onDeviceState(ieee: string, payload: Record<string, unknown>): void {
    const patch: Record<string, unknown> = {};
    if (typeof payload.presence === 'boolean') patch.presence = payload.presence;
    if (typeof payload.linkquality === 'number') patch.linkquality = payload.linkquality;
    if (Object.keys(patch).length) applyPatch(`zigbee/${ieee}`, patch);

    if (typeof payload.presence !== 'boolean') return;
    presenceBySensor.set(ieee, payload.presence);
    for (const space of spacesBySensor.get(ieee) ?? []) evaluate(space);
  }

  const client = mqtt.connect(MQTT_URL, { reconnectPeriod: 5_000 });
  const devicesTopic = `${ZIGBEE_BASE_TOPIC}/bridge/devices`;

  /** Ask each configured sensor for its presence — Z2M doesn't retain state. */
  function requestPresence(): void {
    for (const ieee of spacesBySensor.keys()) {
      const name = nameByIeee.get(ieee);
      if (name) client.publish(`${ZIGBEE_BASE_TOPIC}/${name}/get`, JSON.stringify({ presence: '' }));
    }
  }

  client.on('connect', () => {
    console.log(`[zigbee] connected to ${MQTT_URL}; ${spaces.length} space(s), ${spacesBySensor.size} sensor(s)`);
    client.subscribe(`${ZIGBEE_BASE_TOPIC}/#`);
  });
  client.on('error', e => console.error('[zigbee] mqtt error:', e.message));

  client.on('message', (topic, buf) => {
    if (topic === devicesTopic) {
      try {
        const devices = JSON.parse(buf.toString()) as { ieee_address?: string; friendly_name?: string }[];
        const firstList = nameByIeee.size === 0;
        ieeeByName.clear();
        nameByIeee.clear();
        for (const d of devices) {
          if (!d.ieee_address || !d.friendly_name) continue;
          const ieee = d.ieee_address.toLowerCase();
          ieeeByName.set(d.friendly_name, ieee);
          nameByIeee.set(ieee, d.friendly_name);
        }
        if (firstList) requestPresence();
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
