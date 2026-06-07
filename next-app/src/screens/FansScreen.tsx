'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { LargeTitle } from '@/components/LargeTitle';
import { FanCard } from '@/components/FanCard';
import { pillBtn } from '@/lib/styles';
import type { FanState } from '@/types/state';

export function FansScreen() {
  const { st, setD, config } = useHC();
  const onCount = config.fans.filter(f => (st[f.id] as FanState | undefined)?.on).length;
  const allOff = () => config.fans.forEach(f => setD(f.id, { on: false, speed: 0 }));

  return (
    <div>
      <LargeTitle title="Fans" sub={`${onCount} running`}
        right={onCount > 0 ? <button onClick={allOff} style={pillBtn}>All Off</button> : undefined} />
      <div className="hca-tile-grid">
        {config.fans.map(f => <FanCard key={f.id} fan={f} />)}
      </div>
    </div>
  );
}
