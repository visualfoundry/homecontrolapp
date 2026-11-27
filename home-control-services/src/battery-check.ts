// =============================================================================
// Silent-battery report — read from WordPress
//
// Insteon sensors often go flat without reporting a low battery. WordPress runs
// a daily check of every EISY's event log (inc/battery-check.php) and publishes
// which sensors have gone quiet for far longer than their own history. Those are
// treated here as low-battery, exactly as if the sensor had said so.
// =============================================================================

import { WP_BASE_URL, HCA_INTERNAL_KEY } from './config.js';

const REFRESH_MS = 30 * 60 * 1000;
/** A report older than this is ignored — a stalled WP cron must not leave sensors flagged for ever. */
const STALE_MS = 36 * 60 * 60 * 1000;

let silent = new Set<string>();
let reportAt = 0;

/** True when WordPress's last check found this sensor's state id silent. */
export function isBatterySilent(stateId: string): boolean {
  return Date.now() - reportAt < STALE_MS && silent.has(stateId);
}

async function refresh(): Promise<void> {
  if (!WP_BASE_URL || !HCA_INTERNAL_KEY) return;
  try {
    const res = await fetch(`${WP_BASE_URL}/wp-json/hca/v1/battery-check`, {
      headers: { 'X-HCA-Internal-Key': HCA_INTERNAL_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json() as { checkedAt: string | null; devices: { stateId: string; status: string; name: string }[] };
    if (!body.checkedAt) return;
    const next = new Set(body.devices.filter(d => d.status === 'silent').map(d => d.stateId));
    const added = [...next].filter(id => !silent.has(id));
    silent = next;
    reportAt = Date.parse(body.checkedAt);
    if (added.length) console.log(`[battery-check] silent: ${added.join(', ')}`);
  } catch (err) {
    console.warn('[battery-check] refresh failed:', err instanceof Error ? err.message : err);
  }
}

export function startBatteryCheck(): void {
  void refresh();
  setInterval(() => void refresh(), REFRESH_MS).unref();
}
