'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Segmented } from '@/components/Segmented';
import { LargeTitle } from '@/components/LargeTitle';
import { ClimateZoneCard } from '@/components/ClimateZoneCard';

const CLIMATE_MODES = ['Home', 'Away', 'Sleep'] as const;
type ClimateMode = typeof CLIMATE_MODES[number];

// ISY variable: 1=Home, 2=Away, 3=Sleep
const valueToMode = (v: number | undefined): ClimateMode =>
  v === 2 ? 'Away' : v === 3 ? 'Sleep' : 'Home';
const modeToValue = (m: ClimateMode): number =>
  m === 'Away' ? 2 : m === 'Sleep' ? 3 : 1;

export function ClimateScreen() {
  const { st, setD, config } = useHC();

  const raw = config.houseClimateId
    ? (st[config.houseClimateId] as { value?: number } | undefined)?.value
    : undefined;
  const mode = valueToMode(raw);

  const setMode = (m: string) => {
    if (config.houseClimateId) setD(config.houseClimateId, { value: modeToValue(m as ClimateMode) });
  };

  return (
    <div>
      <LargeTitle title="Climate" sub={`${config.climate.length} zones · ${mode}`} />
      <div style={{ paddingBottom: 18 }}>
        <Segmented options={[...CLIMATE_MODES]} value={mode} onChange={setMode} />
      </div>
      <div className="hca-tile-grid">
        {config.climate.map(c => <ClimateZoneCard key={c.id} zone={c} />)}
      </div>
    </div>
  );
}
