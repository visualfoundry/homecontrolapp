'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { useServiceHealth } from '@/lib/service-health';

/**
 * Two views of the same outage.
 *
 * `ServiceHealthBanner` is the full message, and belongs on the Home screen where
 * there is room to say which rooms stopped reporting and how long ago.
 *
 * `ServiceHealthStrip` is the one-liner every other screen carries. It exists
 * because a command is sent from every screen, so no screen may look trustworthy
 * while the house isn't — but a lights page is not the place for the whole story,
 * only for the fact that there is one. Tapping it goes to Home for the rest.
 *
 * Both read the same derivation, so they can never disagree.
 */

/** Amber, not red: nothing here is damage, it is a loss of confidence. Red is
 *  spoken for by the leak banner, which outranks this and must stay distinct. */
const TONE = 'var(--amber)';

// ---------------------------------------------------------------------------
// Full — Home screen
// ---------------------------------------------------------------------------

export function ServiceHealthBanner() {
  const health = useServiceHealth();
  if (!health) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex', alignItems: 'center', gap: 13, width: '100%',
        background: TONE, color: '#fff', textAlign: 'left',
        borderRadius: 'var(--radius)', padding: '13px 16px',
        margin: '0 0 14px', boxShadow: 'var(--shadow)',
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0 }}>
        <Icon name="bolt" size={24} strokeWidth={2.3} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15.5, fontWeight: 680 }}>
          {health.brief}
        </span>
        {health.detail && (
          <span style={{ display: 'block', fontSize: 13, opacity: 0.92, marginTop: 1 }}>
            {health.detail}
          </span>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One-liner — every other screen, from the shell
// ---------------------------------------------------------------------------

export function ServiceHealthStrip() {
  const { go } = useHC();
  const health = useServiceHealth();
  if (!health) return null;

  return (
    <button
      onClick={() => go('home')}
      aria-label={`${health.brief}. ${health.detail} Open Home for details.`}
      style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, width: '100%',
        background: TONE, color: '#fff', textAlign: 'left', border: 'none',
        borderTop: '0.5px solid rgba(0,0,0,0.12)',
        padding: '8px var(--screen-px)', cursor: 'pointer', font: 'inherit',
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0, opacity: 0.95 }}>
        <Icon name="bolt" size={15} strokeWidth={2.5} />
      </span>
      <span style={{
        flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {health.brief}
      </span>
      <Icon name="chevron" size={14} />
    </button>
  );
}
