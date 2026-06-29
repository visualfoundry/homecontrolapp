import { NextRequest, NextResponse } from 'next/server';
import { sendToAll, setActiveAlert, clearActiveAlert, type PushPayload } from '@/lib/push';

/**
 * POST /api/push/notify
 *
 * Internal endpoint — called by the home-control service when a device event
 * should trigger a push notification. Protected by X-HCA-Internal-Key.
 *
 * Body: {
 *   title?:    string      // defaults to "Home Control"
 *   body:      string      // notification text (required unless clear)
 *   url?:      string      // tap destination (defaults to "/")
 *   alertKey?: string      // e.g. "low-battery:42", "leak:sensor-15"
 *   clear?:    boolean     // true = resolve the alert (stop daily repeats)
 * }
 *
 * Persistent alerts (alertKey without clear):
 *   — sent immediately AND recorded in push-alerts.json.
 *   — the scheduler re-sends them every 24 h (PUSH_ALERT_RESEND_HOURS) until
 *     the service POSTs { alertKey, clear: true }.
 *
 * Service-side contract (home-control service must implement):
 *   — Battery low:  POST { body: "...", alertKey: "low-battery:<deviceId>" }
 *   — Battery ok:   POST { alertKey: "low-battery:<deviceId>", clear: true }
 *   — Leak:         POST { body: "...", alertKey: "leak:<sensorId>" }
 *   — Leak cleared: POST { alertKey: "leak:<sensorId>", clear: true }
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-hca-internal-key');
  if (!key || key !== process.env.HCA_INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json() as Partial<PushPayload> & { alertKey?: string; clear?: boolean };

  // ── Clear a persistent alert (condition resolved) ─────────────────────────
  if (data.alertKey && data.clear) {
    clearActiveAlert(data.alertKey);
    return NextResponse.json({ ok: true, action: 'cleared' });
  }

  // ── Fire a notification ───────────────────────────────────────────────────
  if (!data?.body) {
    return NextResponse.json({ error: 'Missing body' }, { status: 400 });
  }

  const payload: PushPayload = {
    title: data.title ?? 'Home Control',
    body:  data.body,
    url:   data.url  ?? '/',
  };

  await sendToAll(payload);

  // If an alertKey is supplied, persist for daily re-notification.
  if (data.alertKey) {
    setActiveAlert(data.alertKey, payload);
  }

  return NextResponse.json({ ok: true });
}
