'use client';

import React, { useState } from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Toggle } from '@/components/Toggle'; // used for room master toggle
import { Slider } from '@/components/Slider';
import { Card } from '@/components/Card';
import { Segmented } from '@/components/Segmented';
import { LargeTitle } from '@/components/LargeTitle';
import { pillBtn } from '@/lib/styles';
import type { LightState } from '@/types/state';

function LightBar({ id, name, snap }: { id: string; name: string; snap?: boolean }) {
  const { st, setD } = useHC();
  const s = (st[id] as LightState | undefined) ?? { on: false, level: 0 };
  const set = (level: number) => {
    const snapped = snap ? (level >= 50 ? 100 : 0) : level;
    setD(id, { level: snapped, on: snapped > 0 });
  };
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setD(id, { on: !s.on, level: !s.on ? 100 : 0 });
  };
  return (
    <div style={{ position: 'relative', height: 54, borderRadius: 15, overflow: 'hidden', background: 'var(--slider-track)', touchAction: 'none', userSelect: 'none' }}>
      <Slider value={s.on ? s.level : 0} onChange={set} height={54} track="transparent" fill="linear-gradient(90deg,#f5b942,#ffd86b)" />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span onClick={toggle} style={{ pointerEvents: 'auto', cursor: 'pointer', color: s.on ? '#8a5a00' : 'var(--text3)', display: 'flex' }}>
            <Icon name="bulb" size={21} strokeWidth={1.9} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: s.on ? '#5c3d00' : 'var(--text)', letterSpacing: -0.2 }}>{name}</span>
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: s.on ? '#7a5200' : 'var(--text3)' }}>{s.on ? (snap ? '100%' : s.level + '%') : 'Off'}</span>
      </div>
    </div>
  );
}

export function LightsScreen() {
  const { st, setD, config } = useHC();
  const [onlyOn, setOnlyOn] = useState(false);

  const totalOn = config.lightRooms.reduce((n, r) =>
    n + r.lights.filter(l => (st[l.id] as LightState | undefined)?.on).length, 0);
  const allOff = () => config.lightRooms.forEach(r => r.lights.forEach(l => setD(l.id, { on: false })));
  const rooms = onlyOn
    ? config.lightRooms.map(r => ({ ...r, lights: r.lights.filter(l => (st[l.id] as LightState | undefined)?.on) })).filter(r => r.lights.length)
    : config.lightRooms;

  return (
    <div>
      <LargeTitle title="Lights" sub={`${totalOn} on across the house`}
        right={totalOn > 0 ? <button onClick={allOff} style={pillBtn}>All Off</button> : undefined} />
      <div style={{ paddingBottom: 16 }}>
        <Segmented options={['All Lights', 'On Now']} value={onlyOn ? 'On Now' : 'All Lights'}
          onChange={(v) => setOnlyOn(v === 'On Now')} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {rooms.map(r => {
          const roomOn = r.lights.some(l => (st[l.id] as LightState | undefined)?.on);
          const masterToggle = () => r.lights.forEach(l => {
            const s = st[l.id] as LightState | undefined;
            setD(l.id, { on: !roomOn, level: !roomOn ? (s?.level || 100) : (s?.level ?? 100) });
          });
          return (
            <Card key={r.room} pad={false} style={{ padding: '14px 14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, padding: '0 2px' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)', letterSpacing: -0.3 }}>{r.room}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500 }}>
                    {r.lights.filter(l => (st[l.id] as LightState | undefined)?.on).length} of {r.lights.length} on
                  </div>
                </div>
                <Toggle on={roomOn} onChange={masterToggle} accent="var(--amber)" size={0.85} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {r.lights.map(l =>
                  <LightBar key={l.id} id={l.id} name={l.name} snap={l.kind === 'switch'} />
                )}
              </div>
            </Card>
          );
        })}
        {!rooms.length && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40, fontSize: 15 }}>No lights are on.</div>
        )}
      </div>
    </div>
  );
}
