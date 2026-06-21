'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import { deviceTag } from '@/lib/debug';

export function MotionScreen() {
  const { st, config } = useHC();
  // The service may emit { on: bool } for Insteon switch-type nodes instead of { motion: bool }.
  const motionActive = (id: string) => {
    const s = st[id] as { motion?: boolean; on?: boolean } | undefined;
    return s?.motion ?? s?.on ?? false;
  };
  const active = config.motionSensors.filter(s => motionActive(s.id));

  return (
    <div>
      <LargeTitle title="Motion" sub={`${active.length} active now`} />

      {active.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--accent)',
          borderRadius: 'var(--radius)', padding: 16, marginBottom: 18, color: '#fff' }}>
          <Icon name="motion" size={26} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 680 }}>Motion detected</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>{active.map(a => a.name).join(' · ')}</div>
          </div>
        </div>
      )}

      <Card pad={false}>
        {config.motionSensors.map((s, i) => {
          const state = st[s.id] as { motion?: boolean; on?: boolean; lowBattery?: boolean } | undefined;
          const m = state?.motion ?? state?.on ?? false;
          return (
            <div key={s.id} data-control={deviceTag(s.name, s.id, config.controlStateIds)} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px',
              borderBottom: i < config.motionSensors.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>{s.name}</span>
              {state?.lowBattery && (
                <span style={{ color: 'var(--amber)', marginRight: 12, display: 'flex' }} title="Low battery">
                  <Icon name="battery" size={19} />
                </span>
              )}
              <span style={{
                width: 12, height: 12, borderRadius: '50%',
                background: m ? 'var(--red)' : 'var(--switch-off)',
                boxShadow: m ? '0 0 0 4px color-mix(in srgb, var(--red) 25%, transparent)' : 'none',
                display: 'block',
              }} />
            </div>
          );
        })}
      </Card>
    </div>
  );
}
