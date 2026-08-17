'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import type { LeakSensorState } from '@/types/state';

/** Sensors are named "<Place> Water Leak" in WP — the banner already says what
 *  kind of alert this is, so the suffix is noise there. */
function placeOf(name: string): string {
  return name.replace(/\s*water\s*leak\s*$/i, '').trim() || name;
}

/**
 * Persistent water-leak banner.
 *
 * Unlike a notification, this is derived from live device state rather than from
 * something the user can dismiss: it appears the moment a sensor reports wet and
 * disappears only when every sensor reports dry again. A leak is the one alert in
 * this app that must not be possible to swipe away and forget.
 */
export function LeakAlertBanner() {
  const { st, config, go } = useHC();

  const wet = config.leakSensors.filter(s => (st[s.id] as LeakSensorState | undefined)?.wet);
  if (wet.length === 0) return null;

  const where = wet.length === 1
    ? placeOf(wet[0].name)
    : `${wet.map(s => placeOf(s.name)).slice(0, 2).join(', ')}${wet.length > 2 ? ` +${wet.length - 2}` : ''}`;

  return (
    <button
      onClick={() => go('leak')}
      aria-label={`Water detected: ${where}. Open water leak screen.`}
      style={{
        display: 'flex', alignItems: 'center', gap: 13, width: '100%',
        background: 'var(--red)', color: '#fff', textAlign: 'left',
        border: 'none', borderRadius: 'var(--radius)', padding: '14px 16px',
        margin: '0 0 14px', cursor: 'pointer', boxShadow: 'var(--shadow)',
        animation: 'leak-pulse 2.2s ease-in-out infinite',
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0 }}>
        <Icon name="droplet" size={26} strokeWidth={2.4} fill="rgba(255,255,255,0.3)" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 680 }}>
          {wet.length > 1 ? `${wet.length} water leaks detected` : 'Water leak detected'}
        </span>
        <span style={{ display: 'block', fontSize: 13, opacity: 0.9, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {where}
        </span>
      </span>
      <Icon name="chevron" size={18} />
    </button>
  );
}
