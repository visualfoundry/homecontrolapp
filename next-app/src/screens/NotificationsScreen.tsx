'use client';

import React, { useState } from 'react';
import { LargeTitle } from '@/components/LargeTitle';
import { Card, SectionTitle } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { useHC, loadNotifPrefs, saveNotifPrefs } from '@/lib/store';
import type { NotificationPrefs } from '@/types/config';

function Row({
  label,
  description,
  on,
  onChange,
  last,
}: {
  label: string;
  description: string;
  on: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '13px 16px',
        gap: 12,
        borderBottom: last ? 'none' : '0.5px solid var(--sep)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{description}</div>
      </div>
      <Toggle on={on} onChange={onChange} size={0.85} />
    </div>
  );
}

export function NotificationsScreen() {
  const { config } = useHC();
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadNotifPrefs);

  function set<K extends keyof NotificationPrefs>(key: K, value: boolean) {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    saveNotifPrefs(updated);
  }

  const hasLeak   = config.leakSensors.length > 0;
  const hasMotion = config.motionSensors.length > 0;
  const hasDoors  = config.doorsExterior.length > 0 || config.doorsInterior.length > 0;

  const safetyRows = [
    hasLeak   && { key: 'leak'   as const, label: 'Water Leaks',    desc: 'Alert when a sensor detects water' },
    hasMotion && { key: 'motion' as const, label: 'Motion Detected', desc: 'Alert when a motion sensor activates' },
    hasDoors  && { key: 'doors'  as const, label: 'Doors & Locks',   desc: 'Alert when a door opens, closes, or lock state changes' },
  ].filter(Boolean) as { key: keyof NotificationPrefs; label: string; desc: string }[];

  const statusRows: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
    { key: 'houseSecurity', label: 'House Security',  desc: 'Alert when House Security is armed or disarmed' },
    { key: 'whoIsHome',     label: "Who's Home",      desc: 'Alert when someone\'s presence status changes' },
    { key: 'houseMode',     label: 'House Mode',      desc: 'Alert when the time-of-day mode changes (Morning, Day, Evening, Night)' },
  ];

  return (
    <div>
      <LargeTitle title="Notifications" sub="Alert preferences" />

      {safetyRows.length > 0 && (
        <>
          <SectionTitle>Safety</SectionTitle>
          <Card pad={false}>
            {safetyRows.map((row, i) => (
              <Row
                key={row.key}
                label={row.label}
                description={row.desc}
                on={prefs[row.key]}
                onChange={(v) => set(row.key, v)}
                last={i === safetyRows.length - 1}
              />
            ))}
          </Card>
        </>
      )}

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Status &amp; Presence</SectionTitle>
        <Card pad={false}>
          {statusRows.map((row, i) => (
            <Row
              key={row.key}
              label={row.label}
              description={row.desc}
              on={prefs[row.key]}
              onChange={(v) => set(row.key, v)}
              last={i === statusRows.length - 1}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}
