'use client';

import React, { useEffect, useState } from 'react';
import { Toggle } from '@/components/Toggle';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function subscribePush(): Promise<boolean> {
  const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!pubKey || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pubKey).buffer as ArrayBuffer,
    });
  }
  const json = sub.toJSON();
  if (!json.keys) return false;
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
  });
  return res.ok;
}

async function unsubscribePush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

/**
 * PushPermission — settings row with a Toggle for push notifications.
 *
 * Toggle is OFF by default. Turning it on requests browser permission
 * (if not already granted) then subscribes. Turning it off unsubscribes.
 * Renders nothing if the browser doesn't support push.
 */
export function PushPermission({ last }: { last?: boolean }) {
  const [status, setStatus] = useState<NotificationPermission | 'unsupported' | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    const p = Notification.permission;
    setStatus(p);
    if (p === 'granted') {
      // Check if actively subscribed
      navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.getSubscription().then(sub => {
          if (sub) {
            setEnabled(true);
            void subscribePush(); // re-sync with server
          }
        })
      );
    }
  }, []);

  if (!status || status === 'unsupported') return null;

  async function handleToggle(next: boolean) {
    if (next) {
      const permission = await Notification.requestPermission();
      setStatus(permission);
      if (permission === 'granted') {
        const ok = await subscribePush();
        setEnabled(ok);
      }
    } else {
      await unsubscribePush();
      setEnabled(false);
    }
  }

  const denied = status === 'denied';

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 12,
      borderBottom: last ? 'none' : '0.5px solid var(--sep)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>Low battery alerts</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
          {denied
            ? 'Blocked — enable in device Settings → Notifications'
            : 'Get notified when a sensor battery is low'}
        </div>
      </div>
      <Toggle on={enabled} onChange={denied ? undefined : handleToggle} size={0.85} />
    </div>
  );
}
