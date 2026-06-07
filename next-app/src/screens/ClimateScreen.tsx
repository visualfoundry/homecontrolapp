'use client';

import React, { useState } from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { Segmented } from '@/components/Segmented';
import { LargeTitle } from '@/components/LargeTitle';
import { stepBtn } from '@/lib/styles';
import type { ThermostatState } from '@/types/state';

function Dial({ temp, mode }: { temp: number; mode: ThermostatState['mode'] }) {
  const size = 132, r = 56, cx = size / 2, cy = size / 2;
  const start = 135, sweep = 270;
  const lo = 55, hi = 80;
  const frac = Math.max(0, Math.min(1, (temp - lo) / (hi - lo)));
  const C = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * C;
  const col = mode === 'cool' ? '#3d9be0' : mode === 'heat' ? '#e0573d' : '#E0883D';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--slider-track)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${arcLen} ${C}`} transform={`rotate(${start} ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${frac * arcLen} ${C}`} transform={`rotate(${start} ${cx} ${cy})`} />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--text)" style={{ letterSpacing: -1 }}>{temp}°</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={col} style={{ textTransform: 'capitalize' }}>
        {mode === 'cool' ? 'Cooling' : mode === 'heat' ? 'Heating' : 'Auto'}
      </text>
    </svg>
  );
}

export function ClimateScreen() {
  const { st, setD, config } = useHC();
  const [hvac, setHvac] = useState('Home');

  return (
    <div>
      <LargeTitle title="Climate" sub={`${config.climate.length} zones · ${hvac}`} />
      <div style={{ paddingBottom: 18 }}>
        <Segmented options={['Home', 'Away', 'Sleep']} value={hvac} onChange={setHvac} />
      </div>
      <div className="hca-tile-grid">
        {config.climate.map(c => {
          // Default when the state service has no value yet for this zone id,
          // so live (WP-id) zones still render instead of being dropped.
          const s = (st[c.id] as ThermostatState | undefined)
            ?? { temp: 72, mode: 'auto' as const, lo: 68, hi: 76 };
          const nudge = (d: number) => setD(c.id, { temp: Math.round((s.temp + d) * 2) / 2 });
          return (
            <Card key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 12px 14px' }}>
              <div style={{ fontSize: 14.5, fontWeight: 640, color: 'var(--text)', alignSelf: 'flex-start', marginLeft: 4 }}>{c.name}</div>
              <Dial temp={s.temp} mode={s.mode} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 2 }}>
                <button onClick={() => nudge(-0.5)} style={stepBtn}><Icon name="minus" size={18} strokeWidth={2.4} /></button>
                <span style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 560, minWidth: 58, textAlign: 'center' }}>
                  {s.lo}°–{s.hi}°
                </span>
                <button onClick={() => nudge(0.5)} style={stepBtn}><Icon name="plus" size={18} strokeWidth={2.4} /></button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
