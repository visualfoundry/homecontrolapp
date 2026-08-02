'use client';

import React, { useState } from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import { deviceTag } from '@/lib/debug';
import { postCommand } from '@/lib/state-client';

export function MotionScreen() {
  const { st, config } = useHC();
  const [querying, setQuerying] = useState<Set<string>>(new Set());

  const motionActive = (id: string) => {
    const s = st[id] as { motion?: boolean; on?: boolean } | undefined;
    return s?.motion ?? s?.on ?? false;
  };
  const active = config.motionSensors.filter(s => motionActive(s.id));

  const queryBattery = (id: string) => {
    postCommand(id, {}, 'query');
    setQuerying(prev => new Set(prev).add(id));
    setTimeout(() => {
      setQuerying(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 6_000);
  };

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
          const isQuerying = querying.has(s.id);
          return (
            <div key={s.id} data-control={deviceTag(s.name, s.id, config.controlStateIds)} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px',
              borderBottom: i < config.motionSensors.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>{s.name}</span>
              {state?.lowBattery && (
                <button
                  onClick={() => queryBattery(s.id)}
                  disabled={isQuerying}
                  title={isQuerying ? 'Querying…' : 'Low battery — tap to re-query'}
                  style={{
                    background: 'none', border: 'none', padding: 0, marginRight: 12,
                    display: 'flex', cursor: isQuerying ? 'default' : 'pointer',
                    color: 'var(--amber)', opacity: isQuerying ? 0.5 : 1,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <Icon name="battery" size={19} />
                </button>
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
