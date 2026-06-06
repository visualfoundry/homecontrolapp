'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { Slider } from '@/components/Slider';
import { Tile } from '@/components/Tile';
import { LargeTitle } from '@/components/LargeTitle';
import { stepBtn } from '@/lib/styles';
import type { LightState, FlagState, ThermostatState } from '@/types/state';

// ---------------------------------------------------------------------------
// Light bar — same pattern as LightsScreen
// ---------------------------------------------------------------------------

function LightBar({ id, name }: { id: string; name: string }) {
  const { st, setD } = useHC();
  const s = st[id] as LightState | undefined;
  if (!s) return null;
  const set = (level: number) => setD(id, { level, on: level > 0 });
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setD(id, { on: !s.on, level: !s.on ? (s.level || 100) : s.level });
  };
  return (
    <div style={{ position: 'relative', height: 54, borderRadius: 15, overflow: 'hidden', background: 'var(--slider-track)', touchAction: 'none', userSelect: 'none' }}>
      <Slider value={s.on ? s.level : 0} onChange={set} height={54} track="transparent" fill="linear-gradient(90deg,#f5b942,#ffd86b)" />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span onClick={toggle} style={{ pointerEvents: 'auto', cursor: 'pointer', color: s.on ? '#8a5a00' : 'var(--text3)', display: 'flex' }}>
            <Icon name="bulb" size={21} strokeWidth={1.9} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: s.on ? '#5c3d00' : 'var(--text)', letterSpacing: -0.2 }}>{name}</span>
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: s.on ? '#7a5200' : 'var(--text3)' }}>{s.on ? s.level + '%' : 'Off'}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CinemaScreen
// ---------------------------------------------------------------------------

export function CinemaScreen() {
  const { st, setD, config } = useHC();

  const tv     = (st['e-cin-tv']     as FlagState | undefined)?.on ?? false;
  const screen = (st['e-cin-scr']    as FlagState | undefined)?.on ?? false;
  const shades = (st['e-cin-shades'] as FlagState | undefined)?.on ?? false;

  const cinemaRoom = config.lightRooms.find(r => r.room === 'Cinema');
  const cinemaLightsOn = cinemaRoom?.lights.filter(l => (st[l.id] as LightState | undefined)?.on).length ?? 0;
  const totalLights = cinemaRoom?.lights.length ?? 0;
  const masterOn = cinemaLightsOn > 0;
  const masterToggle = () => cinemaRoom?.lights.forEach(l => {
    const s = st[l.id] as LightState | undefined;
    setD(l.id, { on: !masterOn, level: !masterOn ? (s?.level || 100) : (s?.level ?? 100) });
  });

  const climateZone = config.climate.find(c => c.id === 'cl-2c');
  const climate = climateZone ? (st['cl-2c'] as ThermostatState | undefined) : undefined;
  const nudge = (d: number) => {
    if (!climate) return;
    setD('cl-2c', { temp: Math.round((climate.temp + d) * 2) / 2 });
  };

  return (
    <div>
      <LargeTitle title="Cinema" sub="Screen · Lights · Climate" />

      {/* Theater controls */}
      <SectionTitle>Theater</SectionTitle>
      <div className="hca-tile-grid">
        <Tile
          icon="grid"
          name="Theatre"
          status={tv ? 'On' : 'Off'}
          active={tv}
          onToggle={(v) => setD('e-cin-tv', { on: v })}
        />
        <Tile
          icon="chevDown"
          name="Screen Down"
          status={screen ? 'Down' : 'Up'}
          active={screen}
          onToggle={(v) => setD('e-cin-scr', { on: v })}
        />
        <Tile
          icon="shades"
          name="Window Shades"
          status={shades ? 'Down' : 'Up'}
          active={shades}
          onToggle={(v) => setD('e-cin-shades', { on: v })}
        />
      </div>

      {/* Lights */}
      {cinemaRoom && (
        <>
          <SectionTitle>Lights</SectionTitle>
          <Card pad={false} style={{ padding: '14px 14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, padding: '0 2px' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)', letterSpacing: -0.3 }}>Cinema</div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500 }}>
                  {cinemaLightsOn} of {totalLights} on
                </div>
              </div>
              <Toggle on={masterOn} onChange={masterToggle} accent="var(--amber)" size={0.85} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cinemaRoom.lights.map(l => <LightBar key={l.id} id={l.id} name={l.name} />)}
            </div>
          </Card>
        </>
      )}

      {/* Climate */}
      {climate && climateZone && (
        <>
          <SectionTitle>Climate</SectionTitle>
          <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', marginBottom: 2 }}>{climateZone.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, textTransform: 'capitalize' }}>
                {climate.mode === 'cool' ? 'Cooling' : climate.mode === 'heat' ? 'Heating' : 'Auto'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => nudge(-0.5)} style={stepBtn}><Icon name="minus" size={18} strokeWidth={2.4} /></button>
              <div style={{ textAlign: 'center', minWidth: 54 }}>
                <div style={{ fontSize: 28, fontWeight: 720, color: 'var(--text)', letterSpacing: -0.8, lineHeight: 1 }}>{climate.temp}°</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginTop: 3 }}>{climate.lo}°–{climate.hi}°</div>
              </div>
              <button onClick={() => nudge(0.5)} style={stepBtn}><Icon name="plus" size={18} strokeWidth={2.4} /></button>
            </div>
          </Card>
        </>
      )}

      <div style={{ height: 8 }} />
    </div>
  );
}
