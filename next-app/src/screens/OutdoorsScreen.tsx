'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { Slider } from '@/components/Slider';
import { Tile } from '@/components/Tile';
import { LargeTitle } from '@/components/LargeTitle';
import type { OutdoorState, FlagState } from '@/types/state';
import type { OutdoorDevice } from '@/types/config';

function OutdoorTile({ o, icon }: { o: OutdoorDevice; icon: IconName }) {
  const { st, setD } = useHC();
  const s = st[o.id] as OutdoorState | undefined;
  if (!s) return null;
  return (
    <Tile icon={icon} name={o.name} status={s.on ? 'On' : 'Off'} active={s.on}
      onTap={() => setD(o.id, { on: !s.on })}
      control={<Toggle on={s.on} onChange={(v) => setD(o.id, { on: v })} accent="rgba(255,255,255,0.45)" size={0.78} />}
    />
  );
}

export function OutdoorsScreen() {
  const { st, setD, config } = useHC();
  const pergola = st['ob-pergola-l'] as OutdoorState | undefined;
  const autolock = st['ob-autolock'] as FlagState | undefined;

  return (
    <div>
      <LargeTitle title="Outdoors" sub="Pool · Backyard · Doors" />

      <SectionTitle>Pool</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
        <OutdoorTile o={config.outdoorsPool[0]} icon="bulb" />
        <OutdoorTile o={config.outdoorsPool[1]} icon="waterfall" />
        <OutdoorTile o={config.outdoorsPool[2]} icon="bulb" />
        {autolock !== undefined && (
          <Tile
            icon={autolock.on ? 'lock' : 'unlock'}
            name="Doors Auto Lock"
            status={autolock.on ? 'On' : 'Off'}
            active={autolock.on}
            activeColor="var(--green)"
            onTap={() => setD('ob-autolock', { on: !autolock.on })}
            control={<Toggle on={autolock.on} onChange={(v) => setD('ob-autolock', { on: v })} accent="rgba(255,255,255,0.45)" size={0.78} />}
          />
        )}
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Backyard</SectionTitle>

        {/* Pergola dimmer */}
        {pergola !== undefined && (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 620, color: 'var(--text)' }}>Pergola Light</span>
              <Toggle
                on={pergola.on}
                onChange={(v) => setD('ob-pergola-l', { on: v, level: v ? (pergola.level || 70) : pergola.level })}
                accent="var(--amber)"
                size={0.85}
              />
            </div>
            <div style={{ position: 'relative', height: 44, borderRadius: 14, overflow: 'hidden', background: 'var(--slider-track)' }}>
              <Slider
                value={pergola.on ? (pergola.level ?? 0) : 0}
                onChange={(v) => setD('ob-pergola-l', { level: v, on: v > 0 })}
                height={44}
                track="transparent"
                fill="linear-gradient(90deg,#f5b942,#ffd86b)"
              />
              <span style={{ position: 'absolute', right: 14, top: 0, bottom: 0, display: 'flex', alignItems: 'center',
                fontSize: 13.5, fontWeight: 600, pointerEvents: 'none',
                color: pergola.on ? '#7a5200' : 'var(--text3)' }}>
                {pergola.on ? (pergola.level ?? 0) + '%' : 'Off'}
              </span>
            </div>
          </Card>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Pergola Fan */}
          {config.outdoorsBackyard[1] && <OutdoorTile o={config.outdoorsBackyard[1]} icon="fan" />}
          {/* Garden Lights */}
          {config.outdoorsBackyard[2] && <OutdoorTile o={config.outdoorsBackyard[2]} icon="grass" />}
          {/* Water Feature */}
          {config.outdoorsBackyard[3] && <OutdoorTile o={config.outdoorsBackyard[3]} icon="water" />}
        </div>
      </div>
    </div>
  );
}
