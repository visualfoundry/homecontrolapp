'use client';

// =============================================================================
// ClimateZoneCard — one thermostat zone (dial + ± nudge).
// Shared by the Climate screen and the per-place Room screen.
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { deviceTag } from '@/lib/debug';
import { stepBtn } from '@/lib/styles';
import type { ThermostatState } from '@/types/state';
import type { ClimateZone } from '@/types/config';

// ---------------------------------------------------------------------------
// Mode cycling
//
// The order is the thermostat's own — the EISY's CLIMD indexes 0-3 — so the app
// steps through modes in the same order as the unit on the wall. `fan` (index 4)
// is left out: the hardware has it, but nothing in the UI reads or sets it, so
// cycling into it would be a state the app can't explain or leave.
// ---------------------------------------------------------------------------

const MODES = ['off', 'heat', 'cool', 'auto'] as const;

function nextMode(m: ThermostatState['mode']): ThermostatState['mode'] {
  const i = MODES.indexOf(m as typeof MODES[number]);
  return MODES[(i + 1) % MODES.length]!;
}

function Dial({ temp, mode, running, showMode, onPress }: {
  temp: number;
  mode: ThermostatState['mode'];
  running?: ThermostatState['running'];
  /** Show the mode rather than what the system is doing — see `tapMode` below. */
  showMode: boolean;
  onPress: () => void;
}) {
  const size = 132, r = 56, cx = size / 2, cy = size / 2;
  const start = 135, sweep = 270;
  const lo = 60, hi = 90;
  const frac = Math.max(0, Math.min(1, (temp - lo) / (hi - lo)));
  const C = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * C;
  const col = mode === 'cool' ? '#3d9be0' : mode === 'heat' ? '#e0573d' : '#E0883D';
  const activeLabel = running === 'cooling' ? 'Cooling' : running === 'heating' ? 'Heating' : running === 'fan' ? 'Fan' : null;
  const modeLabel = mode === 'cool' ? 'Cool' : mode === 'heat' ? 'Heat' : mode === 'off' ? 'Off' : 'Auto';
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--slider-track)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${arcLen} ${C}`} transform={`rotate(${start} ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${frac * arcLen} ${C}`} transform={`rotate(${start} ${cx} ${cy})`} />
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--text)" style={{ letterSpacing: -1 }}>{temp}°</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={col} style={{ textTransform: 'capitalize' }}>
          {showMode ? modeLabel : (activeLabel ?? modeLabel)}
        </text>
      </svg>
      {/* The dial face. Transparent and sized to the inside of the ring, so it
          stays a comfortable target without covering the arc. */}
      <button
        type="button"
        onClick={onPress}
        aria-label={`Mode: ${modeLabel}. Change mode`}
        style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 88, height: 88, borderRadius: '50%',
          background: 'transparent', border: 'none', padding: 0,
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}
      />
    </div>
  );
}

export function ClimateZoneCard({ zone }: { zone: ClimateZone }) {
  const { st, setD, config } = useHC();
  // Default when the state service has no value yet for this zone id,
  // so live (WP-id) zones still render instead of being dropped.
  const s = (st[zone.id] as ThermostatState | undefined)
    ?? { temp: 72, mode: 'auto' as const, lo: 68, hi: 76 };
  // A tap changes the mode, but `running` still reports what the system was
  // doing until the next poll confirms it — so the label would sit on "Cooling"
  // and the tap would look ignored. Show the mode itself for a few seconds
  // instead, which is also what makes a second tap legible as the next step.
  const [showMode, setShowMode] = useState(false);
  const modeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (modeTimer.current) clearTimeout(modeTimer.current); }, []);

  const tapMode = () => {
    setD(zone.id, { mode: nextMode(s.mode) });
    setShowMode(true);
    if (modeTimer.current) clearTimeout(modeTimer.current);
    modeTimer.current = setTimeout(() => setShowMode(false), 4_000);
  };

  const nudge = (d: number) => {
    const round = (v: number) => Math.round(v * 2) / 2;
    if (s.mode === 'heat') {
      setD(zone.id, { lo: round(s.lo + d) });
    } else if (s.mode === 'cool') {
      setD(zone.id, { hi: round(s.hi + d) });
    } else if (s.mode === 'auto') {
      setD(zone.id, { lo: round(s.lo + d), hi: round(s.hi + d) });
    }
  };
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 12px 14px' }} data-control={deviceTag(zone.name, zone.id, config.controlStateIds)}>
      <div style={{ fontSize: 14.5, fontWeight: 640, color: 'var(--text)', alignSelf: 'flex-start', marginLeft: 4 }}>{zone.name}</div>
      <Dial temp={s.temp} mode={s.mode} running={s.running} showMode={showMode} onPress={tapMode} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 2 }}>
        <button onClick={() => nudge(-0.5)} style={stepBtn}><Icon name="minus" size={18} strokeWidth={2.4} /></button>
        <span style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 560, minWidth: 58, textAlign: 'center' }}>
          {s.mode === 'heat' ? `${s.lo}°` : s.mode === 'cool' ? `${s.hi}°` : s.mode === 'auto' ? `${s.lo}°–${s.hi}°` : '—'}
        </span>
        <button onClick={() => nudge(0.5)} style={stepBtn}><Icon name="plus" size={18} strokeWidth={2.4} /></button>
      </div>
    </Card>
  );
}
