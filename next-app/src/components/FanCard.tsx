'use client';

// =============================================================================
// FanCard — one fan tile (icon + toggle + speed segmented).
// Shared by the Fans screen and the per-place Room screen.
// =============================================================================

import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { deviceTag } from '@/lib/debug';
import { Toggle } from '@/components/Toggle';
import type { FanState } from '@/types/state';
import type { FanDevice } from '@/types/config';

const SPEEDS = ['Off', 'Low', 'Med', 'High'] as const;

export function FanCard({ fan }: { fan: FanDevice }) {
  const { st, setD, config } = useHC();
  const s = (st[fan.id] as FanState | undefined) ?? { on: false, speed: 0 as FanState['speed'] };
  const setSpeed = (sp: number) => setD(fan.id, { speed: sp as FanState['speed'], on: sp > 0 });
  const spinDuration = s.on ? `${1.4 - s.speed * 0.3}s` : undefined;

  return (
    <Card style={{ padding: 15 }} data-control={deviceTag(fan.name, fan.id, config.controlStateIds)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: s.on ? 'var(--accent)' : 'var(--icon-bg)',
          color: s.on ? '#fff' : 'var(--text2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ display: 'flex', animation: s.on ? `spin ${spinDuration} linear infinite` : 'none' }}>
            <Icon name="fan" size={23} />
          </span>
        </div>
        <Toggle
          on={s.on}
          onChange={(v) => setD(fan.id, { on: v })}
          size={0.78}
        />
      </div>
      <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', margin: '13px 0 10px', letterSpacing: -0.2 }}>
        {fan.name}
      </div>
      <div style={{ display: 'flex', gap: 4, background: 'var(--seg-bg)', borderRadius: 10, padding: 3 }}>
        {SPEEDS.map((sp, idx) => (
          <button key={sp} onClick={() => setSpeed(idx)} style={{
            flex: 1, border: 'none', cursor: 'pointer', borderRadius: 7, padding: '5px 0',
            fontSize: 11.5, fontWeight: 620,
            background: s.speed === idx ? 'var(--seg-active)' : 'transparent',
            color: s.speed === idx ? 'var(--text)' : 'var(--text3)',
            boxShadow: s.speed === idx ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
            WebkitTapHighlightColor: 'transparent',
          }}>{sp}</button>
        ))}
      </div>
    </Card>
  );
}
