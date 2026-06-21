'use client';

import React, { useEffect, useState } from 'react';

// Convert the base64url VAPID public key to a Uint8Array for the push API.
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

/**
 * PushPermission — renders a small opt-in row.
 *
 * Shows nothing if:
 * - The browser doesn't support push
 * - Permission is already granted (silently re-subscribes in the background)
 * - Permission is 'denied' (user already said no — don't nag)
 *
 * Shows an "Enable alerts" button when permission is 'default' (not yet asked).
 */
export function PushPermission() {
  const [status, setStatus] = useState<NotificationPermission | 'unsupported' | null>(null);

  useEffect(() => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    const p = Notification.permission;
    setStatus(p);
    // Already granted — re-sync subscription silently (handles re-installs)
    if (p === 'granted') {
      void subscribePush();
    }
  }, []);

  if (!status || status === 'unsupported' || status === 'granted' || status === 'denied') {
    return null;
  }

  async function handleEnable() {
    const permission = await Notification.requestPermission();
    setStatus(permission);
    if (permission === 'granted') await subscribePush();
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--card)', borderRadius: 'var(--radius)',
      padding: '12px 16px', marginTop: 16,
      boxShadow: 'var(--shadow)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Battery alerts</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
          Get notified when a sensor battery is low
        </div>
      </div>
      <button
        onClick={handleEnable}
        style={{
          padding: '8px 14px', borderRadius: 999, border: 'none',
          background: 'var(--accent)', color: '#fff',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        Enable
      </button>
    </div>
  );
}
