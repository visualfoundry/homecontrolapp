'use client';

import React, { useState } from 'react';
import { useHC } from '@/lib/store';
import { Segmented } from '@/components/Segmented';
import { LargeTitle } from '@/components/LargeTitle';
import { LightRoomCard } from '@/components/LightRoomCard';
import { pillBtn } from '@/lib/styles';
import type { LightState } from '@/types/state';

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
        {rooms.map(r => <LightRoomCard key={r.room} room={r} />)}
        {!rooms.length && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40, fontSize: 15 }}>No lights are on.</div>
        )}
      </div>
    </div>
  );
}
