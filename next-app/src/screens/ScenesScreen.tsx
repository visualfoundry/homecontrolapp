'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Segmented } from '@/components/Segmented';
import { SceneRoomCard } from '@/components/SceneRoomCard';
import { LargeTitle } from '@/components/LargeTitle';
import { pillBtn } from '@/lib/styles';
import type { AutomationState, GlobalState } from '@/types/state';
import type { SceneRoomConfig, UserPrefs } from '@/types/config';
import type { SceneRoomTypeKey, TimeOfDayKey } from '@/types/config';

export function ScenesScreen() {
  const { st, setD, config, prefs, setPrefs } = useHC();
  const global = st['_global'] as GlobalState;
  const tod = global.timeOfDay as TimeOfDayKey;
  const view = prefs.sceneView;
  const compact = view === 'Compact';

  const set = (id: string, patch: Partial<AutomationState>) => setD('auto:' + id, patch);

  const rooms = config.sceneRooms.map(r => {
    const a = st['auto:' + r.id] as AutomationState | undefined;
    if (!a) return null;
    const scene = config.sceneSchedules[r.type as SceneRoomTypeKey]?.[tod] ?? '—';
    return { r, a, scene };
  }).filter(Boolean) as Array<{ r: SceneRoomConfig; a: AutomationState; scene: string }>;

  const needsResume = rooms.filter(x => !x.a.automated || x.a.manual || (x.r.hasDoor && !x.a.doorOpen)).length;
  const resumeAll = () => config.sceneRooms.forEach(r => set(r.id, { automated: true, manual: false }));

  return (
    <div>
      <LargeTitle title="Scenes" sub="Standard scenes · motion-activated"
        right={needsResume > 0 ? (
          <button onClick={resumeAll} style={{ ...pillBtn, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="refresh" size={16} strokeWidth={2.2} /> Resume all
          </button>
        ) : undefined}
      />

      <div style={{ paddingBottom: 4 }}>
        <Segmented options={['Detailed', 'Compact']} value={view}
          onChange={(v) => setPrefs({ sceneView: v as UserPrefs['sceneView'] })} />
      </div>

      <div style={{ paddingTop: 14, paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: compact ? 10 : 13 }}>
        {rooms.map(({ r, a, scene }) => (
          <SceneRoomCard key={r.id} room={r} a={a} scene={scene} compact={compact} />
        ))}
      </div>
      <div style={{ height: 8 }} />
    </div>
  );
}
