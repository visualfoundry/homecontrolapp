'use client';

import React, { useState } from 'react';
import { useHC } from '@/lib/store';
import { Segmented } from '@/components/Segmented';
import { LargeTitle } from '@/components/LargeTitle';
import { ClimateZoneCard } from '@/components/ClimateZoneCard';

export function ClimateScreen() {
  const { config } = useHC();
  const [hvac, setHvac] = useState('Home');

  return (
    <div>
      <LargeTitle title="Climate" sub={`${config.climate.length} zones · ${hvac}`} />
      <div style={{ paddingBottom: 18 }}>
        <Segmented options={['Home', 'Away', 'Sleep']} value={hvac} onChange={setHvac} />
      </div>
      <div className="hca-tile-grid">
        {config.climate.map(c => <ClimateZoneCard key={c.id} zone={c} />)}
      </div>
    </div>
  );
}
