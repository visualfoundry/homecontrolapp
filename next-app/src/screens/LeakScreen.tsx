'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import type { LeakSensorState } from '@/types/state';

export function LeakScreen() {
  const { st, config } = useHC();
  const wet = config.leakSensors.filter(s => (st[s.id] as LeakSensorState | undefined)?.wet).length;

  return (
    <div>
      <LargeTitle title="Water Leak" sub={wet > 0 ? `${wet} alert${wet > 1 ? 's' : ''}` : 'All sensors dry'} />

      {wet === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--green)',
          borderRadius: 'var(--radius)', padding: 16, marginBottom: 18, color: '#fff' }}>
          <Icon name="check" size={26} strokeWidth={2.4} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 680 }}>No leaks detected</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              {config.leakSensors.length} sensors reporting · Water mains open
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--red)',
          borderRadius: 'var(--radius)', padding: 16, marginBottom: 18, color: '#fff' }}>
          <Icon name="droplet" size={26} strokeWidth={2.4} fill="rgba(255,255,255,0.3)" />
          <div>
            <div style={{ fontSize: 16, fontWeight: 680 }}>{wet} leak{wet > 1 ? 's' : ''} detected</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>Check sensors below immediately</div>
          </div>
        </div>
      )}

      <Card pad={false}>
        {config.leakSensors.map((s, i) => {
          const state = st[s.id] as LeakSensorState | undefined;
          const isWet = state?.wet ?? false;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px',
              borderBottom: i < config.leakSensors.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10,
                background: isWet ? 'var(--red)' : 'var(--icon-bg)',
                color: isWet ? '#fff' : '#5a9bd4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                <Icon name="droplet" size={19} fill={isWet ? 'currentColor' : 'none'} />
              </div>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>{s.name}</span>
              <span style={{ fontSize: 13.5, fontWeight: 640, color: isWet ? 'var(--red)' : 'var(--green)' }}>
                {isWet ? 'Leak!' : 'Dry'}
              </span>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
