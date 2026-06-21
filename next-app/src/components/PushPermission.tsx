'use client';

import React, { useEffect, useState } from 'react';

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
 * PushPermission — settings row for managing push notification permission.
 *
 * Renders nothing if the browser doesn't support push notifications at all.
 * Otherwise always renders, showing the current permission status:
 *   default  → "Enable" button
 *   granted  → "Enabled" status label (re-syncs subscription silently)
 *   denied   → "Blocked — change in Settings" label
 */
export function PushPermission() {
  const [status, setStatus] = useState<NotificationPermission | 'unsupported' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    const p = Notification.permission;
    setStatus(p);
    if (p === 'granted') void subscribePush();
  }, []);

  // Not supported or still detecting
  if (!status || status === 'unsupported') return null;

  async function handleEnable() {
    setBusy(true);
    const permission = await Notification.requestPermission();
    setStatus(permission);
    if (permission === 'granted') await subscribePush();
    setBusy(false);
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', padding: '13px 16px',
  };

  const labelStyle: React.CSSProperties = {
    flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)',
  };

  const subStyle: React.CSSProperties = {
    fontSize: 13, color: 'var(--text2)', marginTop: 2,
  };

  if (status === 'granted') {
    return (
      <div style={rowStyle}>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Low battery alerts</div>
          <div style={subStyle}>Push notifications are enabled</div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>Enabled</span>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div style={rowStyle}>
        <div style={{ flex: 1 }}>
          <div style={labelStyle}>Low battery alerts</div>
          <div style={subStyle}>Blocked — enable in device Settings → Notifications</div>
        </div>
      </div>
    );
  }

  // 'default' — not yet asked
  return (
    <div style={rowStyle}>
      <div style={{ flex: 1 }}>
        <div style={labelStyle}>Low battery alerts</div>
        <div style={subStyle}>Get notified when a sensor battery is low</div>
      </div>
      <button
        onClick={handleEnable}
        disabled={busy}
        style={{
          padding: '7px 14px', borderRadius: 999, border: 'none',
          background: 'var(--accent)', color: '#fff',
          fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {busy ? 'Enabling…' : 'Enable'}
      </button>
    </div>
  );
}
