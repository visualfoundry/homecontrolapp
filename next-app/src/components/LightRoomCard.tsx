'use client';

// =============================================================================
// LightBar / LightRoomCard — shared light controls.
// Used by the Lights screen and the per-place Room screen so they render
// identically. LightBar = one light's slider row; LightRoomCard = one room's
// Card (header + "X of Y on" + master toggle + LightBar list).
// =============================================================================

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Toggle } from '@/components/Toggle';
import { Slider } from '@/components/Slider';
import { Card } from '@/components/Card';
import type { LightState } from '@/types/state';
import type { LightRoom } from '@/types/config';

export function LightBar({ id, name, snap }: { id: string; name: string; snap?: boolean }) {
  const { st, setD } = useHC();
  const s = (st[id] as LightState | undefined) ?? { on: false, level: 0 };
  const [dragLevel, setDragLevel] = React.useState<number | null>(null);
  const displayLevel = dragLevel ?? (s.on ? s.level : 0);

  const onDrag = (level: number) => {
    setDragLevel(snap ? (level >= 50 ? 100 : 0) : level);
  };
  const onCommit = (level: number) => {
    const snapped = snap ? (level >= 50 ? 100 : 0) : level;
    setDragLevel(null);
    setD(id, { level: snapped, on: snapped > 0 });
  };
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setD(id, { on: !s.on, level: !s.on ? 100 : 0 });
  };
  return (
    <div style={{ position: 'relative', height: 54, borderRadius: 15, overflow: 'hidden', background: 'var(--slider-track)', touchAction: 'none', userSelect: 'none' }}>
      <Slider value={displayLevel} onChange={onDrag} onCommit={onCommit} height={54} track="transparent" fill="linear-gradient(90deg,#f5b942,#ffd86b)" />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span onClick={toggle} style={{ pointerEvents: 'auto', cursor: 'pointer', color: s.on ? '#8a5a00' : 'var(--text3)', display: 'flex' }}>
            <Icon name="bulb" size={21} strokeWidth={1.9} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: s.on ? '#5c3d00' : 'var(--text)', letterSpacing: -0.2 }}>{name}</span>
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: s.on ? '#7a5200' : 'var(--text3)' }}>{s.on ? (snap ? '100%' : displayLevel + '%') : 'Off'}</span>
      </div>
    </div>
  );
}

export function LightRoomCard({ room }: { room: LightRoom }) {
  const { st, setD } = useHC();
  const roomOn = room.lights.some(l => (st[l.id] as LightState | undefined)?.on);
  const masterToggle = () => room.lights.forEach(l => {
    const s = st[l.id] as LightState | undefined;
    setD(l.id, { on: !roomOn, level: !roomOn ? (s?.level || 100) : (s?.level ?? 100) });
  });
  return (
    <Card pad={false} style={{ padding: '14px 14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, padding: '0 2px' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)', letterSpacing: -0.3 }}>{room.room}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500 }}>
            {room.lights.filter(l => (st[l.id] as LightState | undefined)?.on).length} of {room.lights.length} on
          </div>
        </div>
        <Toggle on={roomOn} onChange={masterToggle} accent="var(--amber)" size={0.85} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {room.lights.map(l =>
          <LightBar key={l.id} id={l.id} name={l.name} snap={l.kind === 'switch'} />
        )}
      </div>
    </Card>
  );
}
