'use client';

// =============================================================================
// SpeakerRow — one speaker zone row (mute + toggle + volume slider).
// Shared by the Music screen and the per-place Room screen. Wrap rows in a
// <Card pad={false} style={{ padding: '6px 14px' }}>; pass `last` to drop the
// bottom separator.
// =============================================================================

import React, { useRef } from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { deviceTag } from '@/lib/debug';
import { Toggle } from '@/components/Toggle';
import { Slider } from '@/components/Slider';
import type { SpeakerState } from '@/types/state';
import type { MusicZone } from '@/types/config';

// Normalize WP speaker titles: drop the "On-Off" suffix and reorder
// "Speaker <location>" → "<location> Speaker".
export const speakerName = (name: string) => {
  const stripped = name.replace(/\s*On[-/\s]?Off$/i, '').trim();
  const m = /^Speaker\s+(.+)$/i.exec(stripped);
  return m ? `${m[1]} Speaker` : stripped;
};

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'var(--icon-bg)', color: 'var(--text2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent', flexShrink: 0,
};

export function SpeakerRow({ zone, last }: { zone: MusicZone; last?: boolean }) {
  const { st, setD, config } = useHC();
  const s = (st[zone.id] as SpeakerState | undefined) ?? { on: false, vol: 0 };
  const [dragVol, setDragVol] = React.useState<number | null>(null);
  const displayVol = dragVol ?? s.vol;
  // Remember pre-mute volume so we can restore it on unmute.
  const preMuteVol = useRef<number | null>(null);

  const muteSpeaker = () => {
    if (s.vol === 0) {
      setD(zone.id, { vol: preMuteVol.current ?? 30 });
      preMuteVol.current = null;
    } else {
      preMuteVol.current = s.vol;
      setD(zone.id, { vol: 0 });
    }
  };

  return (
    <div data-control={deviceTag(zone.name, zone.id, config.controlStateIds)} style={{ padding: '13px 2px', borderBottom: last ? 'none' : '0.5px solid var(--sep)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{speakerName(zone.name)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={muteSpeaker}
            style={{ ...iconBtn, opacity: s.on ? 1 : 0.35, color: (s.on && s.vol === 0) ? 'var(--accent)' : 'var(--text2)' }}>
            <Icon name={s.on && s.vol > 0 ? 'volume' : 'mute'} size={18} />
          </button>
          <Toggle on={s.on} onChange={(v) => setD(zone.id, { on: v, vol: v && !s.vol ? 30 : s.vol })} size={0.82} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Slider value={displayVol} onChange={setDragVol} onCommit={(v) => { setDragVol(null); setD(zone.id, { vol: v, on: v > 0 }); }} height={30} disabled={!s.on} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', minWidth: 30, textAlign: 'right' }}>
          {s.on ? (displayVol === 0 ? 'Muted' : `${displayVol}%`) : '–'}
        </span>
      </div>
    </div>
  );
}
