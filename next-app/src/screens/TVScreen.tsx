'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Tile } from '@/components/Tile';
import { LargeTitle } from '@/components/LargeTitle';
import { pillBtn } from '@/lib/styles';
import { deviceTag } from '@/lib/debug';
import { tvIsOn, tvPowerPatch, TV_POWER_LOCK_MS } from '@/lib/tv-power';

export function TVScreen() {
  const { st, setD, config, go } = useHC();
  const setPower = (t: (typeof config.tvs)[number], on: boolean) =>
    setD(t.powerId, tvPowerPatch(t, on), TV_POWER_LOCK_MS);
  const onCount = config.tvs.filter(t => tvIsOn(t, st)).length;
  const allOff = () => config.tvs.forEach(t => { if (tvIsOn(t, st)) setPower(t, false); });

  return (
    <div>
      <LargeTitle
        title="TV"
        sub={onCount > 0 ? `${onCount} on` : 'All off'}
        right={onCount > 0 ? <button onClick={allOff} style={pillBtn}>All Off</button> : undefined}
      />
      <div className="hca-tile-grid">
        {config.tvs.map(t => {
          const on = tvIsOn(t, st);
          const hasRemote = !!t.remote;
          return (
            <Tile
              key={t.id}
              icon="tv"
              name={t.name}
              // Power is the switch's job alone. The tile body opens the remote
              // where there is one, and does nothing where there isn't — so a tap
              // can never turn a TV on or off by accident.
              status={hasRemote ? (on ? 'On · Remote' : 'Off · Remote') : (on ? 'On' : 'Off')}
              active={on}
              // Rooms with no button-capable Harmony device lose the chip behind
              // the icon — the one cue that this tile has nothing to open.
              iconChip={hasRemote}
              inert={!hasRemote}
              data-control={deviceTag(t.name, t.id, config.controlStateIds)}
              onToggle={(v) => setPower(t, v)}
              onTap={hasRemote ? () => go(`remote:${t.id}`) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
