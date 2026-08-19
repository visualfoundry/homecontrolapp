'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Tile } from '@/components/Tile';
import { LargeTitle } from '@/components/LargeTitle';
import { pillBtn } from '@/lib/styles';
import { deviceTag } from '@/lib/debug';
import type { FlagState } from '@/types/state';

export function TVScreen() {
  const { st, setD, config, go } = useHC();
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
          const hasRemote = !!t.remote;
          return (
            <Tile
              key={t.id}
              icon="tv"
              name={t.name}
              // Power is the switch's job alone. The tile body opens the remote
              // where there is one, and does nothing where there isn't — so a tap
              // can never turn a TV on or off by accident.
              status={hasRemote ? (on ? 'On · Remote' : 'Off · Remote') : (on ? 'On · No remote' : 'No remote')}
              active={on}
              // Rooms without a button-capable Harmony hub read as recessed and
              // fill neutral grey rather than accent, so they stay visibly apart
              // from the rooms a remote can drive, in both on and off states.
              tint={hasRemote ? undefined : 'var(--tint-unavailable)'}
              bg={hasRemote ? undefined : 'var(--seg-bg)'}
              inert={!hasRemote}
              data-control={deviceTag(t.name, t.id, config.controlStateIds)}
              onToggle={(v) => setD(t.id, { on: v })}
              onTap={hasRemote ? () => go(`remote:${t.id}`) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
