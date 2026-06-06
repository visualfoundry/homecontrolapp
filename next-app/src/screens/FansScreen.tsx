'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { LargeTitle } from '@/components/LargeTitle';
import { pillBtn } from '@/lib/styles';
import type { FanState } from '@/types/state';

const SPEEDS = ['Off', 'Low', 'Med', 'High'] as const;

export function FansScreen() {
  const { st, setD, config } = useHC();
  const onCount = config.fans.filter(f => (st[f.id] as FanState | undefined)?.on).length;
  const allOff = () => config.fans.forEach(f => setD(f.id, { on: false, speed: 0 }));

  return (
    <div>
      <LargeTitle title="Fans" sub={`${onCount} running`}
        right={onCount > 0 ? <button onClick={allOff} style={pillBtn}>All Off</button> : undefined} />
      <div className="hca-tile-grid">
        {config.fans.map(f => {
          const s = (st[f.id] as FanState | undefined) ?? { on: false, speed: 0 as FanState['speed'] };
          const setSpeed = (sp: number) => setD(f.id, { speed: sp as FanState['speed'], on: sp > 0 });
          const spinDuration = s.on ? `${1.4 - s.speed * 0.3}s` : undefined;

          return (
            <Card key={f.id} style={{ padding: 15 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: s.on ? 'var(--accent)' : 'var(--icon-bg)',
                  color: s.on ? '#fff' : 'var(--text2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ display: 'flex', animation: s.on ? `spin ${spinDuration} linear infinite` : 'none' }}>
                    <Icon name="fan" size={23} />
                  </span>
                </div>
                <Toggle
                  on={s.on}
                  onChange={(v) => setD(f.id, { on: v, speed: v ? Math.max(1, s.speed) as FanState['speed'] : 0 })}
                  size={0.78}
                />
              </div>
              <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', margin: '13px 0 10px', letterSpacing: -0.2 }}>
                {f.name}
              </div>
              <div style={{ display: 'flex', gap: 4, background: 'var(--seg-bg)', borderRadius: 10, padding: 3 }}>
                {SPEEDS.map((sp, idx) => (
                  <button key={sp} onClick={() => setSpeed(idx)} style={{
                    flex: 1, border: 'none', cursor: 'pointer', borderRadius: 7, padding: '5px 0',
                    fontSize: 11.5, fontWeight: 620,
                    background: s.speed === idx ? 'var(--seg-active)' : 'transparent',
                    color: s.speed === idx ? 'var(--text)' : 'var(--text3)',
                    boxShadow: s.speed === idx ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
                    WebkitTapHighlightColor: 'transparent',
                  }}>{sp}</button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
