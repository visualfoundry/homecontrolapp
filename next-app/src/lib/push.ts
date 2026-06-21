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
