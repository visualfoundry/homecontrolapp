import { NextRequest, NextResponse } from 'next/server';
import { sendToAll, setActiveAlert, clearActiveAlert, isAlertRateLimited, type PushPayload } from '@/lib/push';
import { patchIdToConfigIds } from '@/lib/state-service';
import { fetchConfig } from '@/lib/config';

/**
 * Resolve a state-service device id to the name the user knows it by.
 *
 * Device names live in the config plane (WP), which the state service has no
 * business reading — so it sends its own id plus a `{device}` placeholder and we
 * fill in the name here. Returns null if the sensor isn't in the config.
 */
async function deviceNameFor(stateId: string): Promise<string | null> {
  try {
    const [configIds, config] = await Promise.all([
      patchIdToConfigIds(stateId),
      fetchConfig(),
    ]);
    const named = [...config.leakSensors, ...config.motionSensors];
    for (const id of configIds) {
      const hit = named.find(d => d.id === id);
      if (hit) return hit.name;
    }
  } catch { /* config unreachable — fall back to the generic wording */ }
  return null;
}

/**
 * POST /api/push/notify
 *
 * Internal endpoint — called by the home-control service when a device event
 * should trigger a push notification. Protected by X-HCA-Internal-Key.
 *
 * Body: {
 *   title?:    string      // defaults to "Home Control"
 *   body:      string      // notification text (required unless clear)
 *   url?:      string      // tap destination, e.g. "/?screen=leak" (defaults to "/")
 *   category?: string      // inbox grouping, e.g. "leak" | "motion" | "doors"
 *   alertKey?: string      // e.g. "low-battery:42", "leak:sensor-15"
 *   clear?:    boolean     // true = resolve the alert (stop daily repeats)
 *   urgent?:   boolean     // high-urgency delivery + a banner that won't auto-dismiss
 *   resendMinutes?: number // override the 24 h repeat interval for this alert
 *   deviceId?: string      // state-service id; fills `{device}` in title/body with
 *                          // the device's name from the config plane
 * }
 *
 * Copy rule: bodies must read correctly both as a system banner and as a row in
 * the in-app inbox — no "open the app to…" phrasing. Send a `url` with ?screen=
 * instead; the notification and the inbox row both become tappable.
 *
 * Persistent alerts (alertKey without clear):
 *   — sent immediately AND recorded in push-alerts.json.
 *   — the scheduler re-sends them every 24 h (PUSH_ALERT_RESEND_HOURS) until
 *     the service POSTs { alertKey, clear: true }.
 *
 * Service-side contract (home-control service must implement):
 *   — Battery low:  POST { body: "...", alertKey: "low-battery:<deviceId>" }
 *   — Battery ok:   POST { alertKey: "low-battery:<deviceId>", clear: true }
 *   — Leak:         POST { body: "Water detected by {device}.", deviceId: "<stateId>",
 *                          alertKey: "leak:<stateId>", urgent: true, resendMinutes: 30 }
 *   — Leak cleared: POST { alertKey: "leak:<sensorId>", clear: true }
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-hca-internal-key');
  if (!key || key !== process.env.HCA_INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json() as Partial<PushPayload> & {
    alertKey?: string; clear?: boolean; resendMinutes?: number; deviceId?: string;
  };

  // ── Clear a persistent alert (condition resolved) ─────────────────────────
  if (data.alertKey && data.clear) {
    clearActiveAlert(data.alertKey);
    return NextResponse.json({ ok: true, action: 'cleared' });
  }

  // ── Fire a notification ───────────────────────────────────────────────────
  if (!data?.body) {
    return NextResponse.json({ error: 'Missing body' }, { status: 400 });
  }

  // `{device}` in the title or body is filled from the config plane.
  const deviceName = data.deviceId ? await deviceNameFor(data.deviceId) : null;
  const withName = (s: string) => s.replace(/\{device\}/g, deviceName ?? 'a sensor');

  const payload: PushPayload = {
    title: withName(data.title ?? 'Home Control'),
    body:  withName(data.body),
    url:   data.url  ?? '/',
    ...(data.category ? { category: data.category } : {}),
    ...(data.urgent   ? { urgent: true } : {}),
    // Repeats of one alert replace their own banner rather than stacking up.
    ...(data.alertKey ? { tag: data.alertKey } : {}),
  };

  const resendMs = data.resendMinutes != null && data.resendMinutes > 0
    ? data.resendMinutes * 60 * 1000
    : undefined;

  // If this is a persistent alert that was already sent within the resend window,
  // record the condition without re-sending. Prevents alert spam on service restart
  // (state resets to fresh in-memory, so every low-battery sensor fires again).
  if (data.alertKey && isAlertRateLimited(data.alertKey, resendMs)) {
    setActiveAlert(data.alertKey, payload, false, resendMs);
    return NextResponse.json({ ok: true, action: 'rate-limited' });
  }

  await sendToAll(payload);

  if (data.alertKey) {
    setActiveAlert(data.alertKey, payload, true, resendMs);
  }

  return NextResponse.json({ ok: true });
}
