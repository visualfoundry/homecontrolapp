// =============================================================================
// Push notification helpers
//
// Subscription storage: a flat JSON file whose path is set by
// PUSH_SUBSCRIPTIONS_FILE (default /tmp/hca-push-subs.json for local dev;
// set to a persistent path on the server, e.g.
//   /home/administrator/homecontrolapp/push-subscriptions.json).
//
// VAPID keys are read from:
//   VAPID_PUBLIC_KEY  — base64url public key (also set as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
//   VAPID_PRIVATE_KEY — base64url private key (server-only)
//   VAPID_SUBJECT     — mailto: or https: URI for the push service contact
// =============================================================================

import webpush from 'web-push';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

declare global {
  // eslint-disable-next-line no-var
  var _hcaAlertInterval: ReturnType<typeof setInterval> | undefined;
}

const vapidPublicKey  = process.env.VAPID_PUBLIC_KEY  ?? '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? '';
const vapidSubject    = process.env.VAPID_SUBJECT     ?? 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// ---------------------------------------------------------------------------
// Subscription persistence
// ---------------------------------------------------------------------------

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const SUBS_FILE = process.env.PUSH_SUBSCRIPTIONS_FILE ?? '/tmp/hca-push-subs.json';

function readSubs(): PushSub[] {
  try {
    if (!existsSync(SUBS_FILE)) return [];
    return JSON.parse(readFileSync(SUBS_FILE, 'utf8')) as PushSub[];
  } catch { return []; }
}

function writeSubs(subs: PushSub[]): void {
  try {
    mkdirSync(dirname(SUBS_FILE), { recursive: true });
    writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
  } catch (e) {
    console.error('[push] failed to write subs file:', e);
  }
}

export function addSubscription(sub: PushSub): void {
  const subs = readSubs().filter(s => s.endpoint !== sub.endpoint);
  subs.push(sub);
  writeSubs(subs);
}

export function removeSubscription(endpoint: string): void {
  writeSubs(readSubs().filter(s => s.endpoint !== endpoint));
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// ---------------------------------------------------------------------------
// Persistent alert tracking — conditions that should re-notify daily until
// the home-control service signals they are resolved (low battery, leak, etc.)
//
// The service includes { alertKey: "low-battery:42" } when firing a persistent
// alert, and { alertKey: "low-battery:42", clear: true } when it is resolved.
//
// PUSH_ALERTS_FILE should point to a persistent path on the server, e.g.
//   /home/administrator/homecontrolapp/push-alerts.json
// ---------------------------------------------------------------------------

export interface ActiveAlert {
  key: string;
  payload: PushPayload;
  firstSent: number;  // unix ms
  lastSent: number;   // unix ms
}

const ALERTS_FILE = process.env.PUSH_ALERTS_FILE ?? '/tmp/hca-push-alerts.json';

// How often to re-send an unresolved alert (default 24 h, override via env).
const RESEND_MS = (parseInt(process.env.PUSH_ALERT_RESEND_HOURS ?? '24', 10) || 24) * 60 * 60 * 1000;

function readAlerts(): ActiveAlert[] {
  try {
    if (!existsSync(ALERTS_FILE)) return [];
    return JSON.parse(readFileSync(ALERTS_FILE, 'utf8')) as ActiveAlert[];
  } catch { return []; }
}

function writeAlerts(alerts: ActiveAlert[]): void {
  try {
    mkdirSync(dirname(ALERTS_FILE), { recursive: true });
    writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
  } catch (e) {
    console.error('[push] failed to write alerts file:', e);
  }
}

/** Record or update a persistent alert. Call after sending the first notification. */
export function setActiveAlert(key: string, payload: PushPayload): void {
  const now = Date.now();
  const alerts = readAlerts();
  const existing = alerts.find(a => a.key === key);
  if (existing) {
    existing.payload = payload;
    existing.lastSent = now;
  } else {
    alerts.push({ key, payload, firstSent: now, lastSent: now });
  }
  writeAlerts(alerts);
  console.log(`[push] active alert set: ${key}`);
}

/** Remove a persistent alert — called when the condition is resolved. */
export function clearActiveAlert(key: string): void {
  writeAlerts(readAlerts().filter(a => a.key !== key));
  console.log(`[push] active alert cleared: ${key}`);
}

/** Re-send any alert that hasn't been sent within the resend window. */
async function checkAndResendAlerts(): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) return;
  const now = Date.now();
  const alerts = readAlerts();
  let changed = false;
  for (const alert of alerts) {
    if (now - alert.lastSent >= RESEND_MS) {
      console.log(`[push] re-sending persistent alert: ${alert.key}`);
      await sendToAll(alert.payload);
      alert.lastSent = now;
      changed = true;
    }
  }
  if (changed) writeAlerts(alerts);
}

/**
 * Start the hourly alert scheduler. Uses a globalThis guard so hot-reloads
 * don't register duplicate intervals. Called from instrumentation.ts on boot.
 */
export function startAlertScheduler(): void {
  if (global._hcaAlertInterval) return;
  global._hcaAlertInterval = setInterval(() => { void checkAndResendAlerts(); }, 60 * 60 * 1000);
  console.log(`[push] alert scheduler started — resend window: ${RESEND_MS / 3_600_000}h`);
}

export async function sendToAll(payload: PushPayload): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[push] VAPID keys not configured — skipping push');
    return;
  }
  const subs = readSubs();
  if (!subs.length) return;

  const data = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map(s => webpush.sendNotification(s, data)),
  );

  // Remove subscriptions the push service reports as expired / invalid
  const toRemove: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const err = r.reason as { statusCode?: number };
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        toRemove.push(subs[i].endpoint);
      }
    }
  });
  toRemove.forEach(e => removeSubscription(e));
}
