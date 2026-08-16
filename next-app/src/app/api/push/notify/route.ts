import { NextRequest, NextResponse } from 'next/server';
import { sendToAll, setActiveAlert, clearActiveAlert, isAlertRateLimited, type PushPayload } from '@/lib/push';

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
    ...(data.category ? { category: data.category } : {}),
  };

  // If this is a persistent alert that was already sent within the resend window,
  // record the condition without re-sending. Prevents alert spam on service restart
  // (state resets to fresh in-memory, so every low-battery sensor fires again).
  if (data.alertKey && isAlertRateLimited(data.alertKey)) {
    setActiveAlert(data.alertKey, payload, false);
    return NextResponse.json({ ok: true, action: 'rate-limited' });
  }

  await sendToAll(payload);

  if (data.alertKey) {
    setActiveAlert(data.alertKey, payload, true);
  }

  return NextResponse.json({ ok: true });
}
