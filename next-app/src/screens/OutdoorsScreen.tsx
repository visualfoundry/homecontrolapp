'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import type { IconName } from '@/components/Icon';
import { SectionTitle } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { Tile } from '@/components/Tile';
import { LargeTitle } from '@/components/LargeTitle';
import { SceneRoomCard } from '@/components/SceneRoomCard';
import type { OutdoorState, AutomationState, GlobalState } from '@/types/state';
import type { OutdoorDevice, SceneRoomConfig, SceneRoomTypeKey, TimeOfDayKey } from '@/types/config';

function OutdoorTile({ o }: { o: OutdoorDevice }) {
  const { st, setD } = useHC();
  const s = st[o.id] as OutdoorState | undefined;
  if (!s) return null;
  const icon: IconName = o.icon ?? 'bulb';
  return (
    <Tile icon={icon} name={o.name} status={s.on ? 'On' : 'Off'} active={s.on}
      onTap={() => setD(o.id, { on: !s.on })}
      control={<Toggle on={s.on} onChange={(v) => setD(o.id, { on: v })} accent="rgba(255,255,255,0.45)" size={0.78} />}
    />
  );
}

export function OutdoorsScreen() {
  const { st, config, go } = useHC();

  const global = st['_global'] as GlobalState;
  const tod = (global?.timeOfDay ?? 'Day') as TimeOfDayKey;

  const outdoorScenes = config.sceneRooms
    .filter(r => /pergola/i.test(r.name) || (/porch/i.test(r.name) && !/front/i.test(r.name)))
    .map(r => {
      const a = st['auto:' + r.id] as AutomationState | undefined;
      if (!a) return null;
      const scene = config.sceneSchedules[r.type as SceneRoomTypeKey]?.[tod] ?? '—';
      return { r, a, scene };
    })
    .filter(Boolean) as Array<{ r: SceneRoomConfig; a: AutomationState; scene: string }>;

  return (
    <div>
      <LargeTitle title="Outdoors" sub="Pool · Backyard · Doors" />

      <SectionTitle action="More" onAction={() => go('pool')}>Pool</SectionTitle>
      <div className="hca-tile-grid" style={{ marginBottom: 4 }}>
        {config.outdoorsPool.map(o => <OutdoorTile key={o.id} o={o} />)}
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionTitle>Backyard</SectionTitle>
        <div className="hca-tile-grid">
          {config.outdoorsBackyard.map(o => <OutdoorTile key={o.id} o={o} />)}
        </div>
      </div>

      {outdoorScenes.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <SectionTitle action="More" onAction={() => go('scenes')}>Scenes</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {outdoorScenes.map(({ r, a, scene }) => (
              <SceneRoomCard key={r.id} room={r} a={a} scene={scene} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
