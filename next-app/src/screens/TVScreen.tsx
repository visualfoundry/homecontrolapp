'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Tile } from '@/components/Tile';
import { LargeTitle } from '@/components/LargeTitle';
import { pillBtn } from '@/lib/styles';
import { deviceTag } from '@/lib/debug';
import type { FlagState } from '@/types/state';

export function TVScreen() {
  const { st, setD, config } = useHC();
  const onCount = config.tvs.filter(t => (st[t.id] as FlagState | undefined)?.on).length;
  const allOff = () => config.tvs.forEach(t => setD(t.id, { on: false }));

  return (
    <div>
      <LargeTitle
        title="TV"
        sub={onCount > 0 ? `${onCount} on` : 'All off'}
        right={onCount > 0 ? <button onClick={allOff} style={pillBtn}>All Off</button> : undefined}
      />
      <div className="hca-tile-grid">
        {config.tvs.map(t => {
          const on = (st[t.id] as FlagState | undefined)?.on ?? false;
          return (
            <Tile
              key={t.id}
              icon="tv"
              name={t.name}
              status={on ? 'On' : 'Off'}
              active={on}
              data-control={deviceTag(t.name, t.id, config.controlStateIds)}
              onToggle={(v) => setD(t.id, { on: v })}
            />
          );
        })}
      </div>
    </div>
  );
}
