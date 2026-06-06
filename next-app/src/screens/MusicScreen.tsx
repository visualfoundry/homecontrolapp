'use client';

import React, { useRef } from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { Slider } from '@/components/Slider';
import { LargeTitle } from '@/components/LargeTitle';
import type { SpeakerState } from '@/types/state';

const miniBtn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 19, border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.12)', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
};

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'var(--icon-bg)', color: 'var(--text2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent', flexShrink: 0,
};

export function MusicScreen() {
  const { st, setD, config } = useHC();
  // Track pre-mute volumes so we can restore them on unmute
  const preMuteVols = useRef<Map<string, number>>(new Map());
  // Capture starting volumes + average when a global-slider drag begins
  const dragBaseVols = useRef<Map<string, number>>(new Map());
  const dragBaseAvg  = useRef<number>(0);

  const zones = config.musicZones.map(m => ({
    ...m,
    s: (st[m.id] as SpeakerState | undefined) ?? { on: false, vol: 0 },
  }));
  const playing = zones.filter(z => z.s.on).length;
  const anyOn = playing > 0;

  // Global volume: average of active speakers, or 50 if none
  const activeSpeakers = zones.filter(z => z.s.on);
  const globalVol = activeSpeakers.length
    ? Math.round(activeSpeakers.reduce((sum, z) => sum + z.s.vol, 0) / activeSpeakers.length)
    : 50;
  const allMuted = activeSpeakers.length > 0 && activeSpeakers.every(z => z.s.vol === 0);

  const allOn  = () => zones.forEach(z => setD(z.id, { on: true,  vol: z.s.vol || 30 }));
  const allOff = () => zones.forEach(z => setD(z.id, { on: false }));

  const captureGlobalDragBase = () => {
    const actives = zones.filter(z => z.s.on);
    dragBaseVols.current.clear();
    actives.forEach(z => dragBaseVols.current.set(z.id, z.s.vol));
    dragBaseAvg.current = actives.length
      ? actives.reduce((sum, z) => sum + z.s.vol, 0) / actives.length
      : 0;
  };

  const setGlobalVol = (v: number) => {
    const base = dragBaseAvg.current;
    zones.filter(z => z.s.on).forEach(z => {
      const startVol = dragBaseVols.current.get(z.id) ?? z.s.vol;
      const newVol = base > 0
        ? Math.round(Math.min(100, Math.max(0, startVol * (v / base))))
        : v;
      setD(z.id, { vol: newVol });
    });
  };

  const muteAll = () => {
    if (allMuted) {
      // Restore pre-mute volumes
      zones.filter(z => z.s.on).forEach(z => {
        setD(z.id, { vol: preMuteVols.current.get(z.id) ?? 30 });
      });
      preMuteVols.current.clear();
    } else {
      zones.filter(z => z.s.on).forEach(z => {
        preMuteVols.current.set(z.id, z.s.vol);
        setD(z.id, { vol: 0 });
      });
    }
  };

  const muteSpeaker = (id: string, vol: number) => {
    const muted = vol === 0;
    if (muted) {
      setD(id, { vol: preMuteVols.current.get(id) ?? 30 });
      preMuteVols.current.delete(id);
    } else {
      preMuteVols.current.set(id, vol);
      setD(id, { vol: 0 });
    }
  };

  return (
    <div>
      <LargeTitle title="Music" sub={`${playing} of ${zones.length} playing`}
        right={<Toggle on={anyOn} onChange={(v) => v ? allOn() : allOff()} size={0.9} />}
      />

      {/* Now playing card */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)',
          background: 'linear-gradient(135deg,#3a2f55,#6a4a7a)', padding: 16,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Icon name="speaker" size={26} />
          </div>
          <div style={{ flex: 1, minWidth: 0, color: '#fff' }}>
            <div style={{ fontSize: 15.5, fontWeight: 660, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sunday Acoustic</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>Living Room</div>
          </div>
          <div style={{ display: 'flex', gap: 8, color: '#fff' }}>
            <button style={miniBtn}><Icon name="prev" size={20} /></button>
            <button style={{ ...miniBtn, background: 'rgba(255,255,255,0.22)' }}><Icon name="pause" size={20} /></button>
            <button style={miniBtn}><Icon name="next" size={20} /></button>
          </div>
        </div>
      </div>

      {/* Global volume controls */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle>All Speakers</SectionTitle>
        <Card pad={false} style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={muteAll} style={{ ...iconBtn, color: allMuted ? 'var(--accent)' : 'var(--text2)', background: allMuted ? 'var(--accent)1f' : 'var(--icon-bg)' }}>
              <Icon name={allMuted ? 'mute' : 'volume'} size={20} />
            </button>
            <div style={{ flex: 1 }} onPointerDown={captureGlobalDragBase}>
              <Slider value={allMuted ? 0 : globalVol} onChange={setGlobalVol} height={34} disabled={!anyOn} fill="var(--accent)" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', minWidth: 34, textAlign: 'right' }}>
              {anyOn ? (allMuted ? 'Muted' : `${globalVol}%`) : '–'}
            </span>
          </div>
        </Card>
      </div>

      {/* Per-speaker list */}
      <SectionTitle>Speakers</SectionTitle>
      <Card pad={false} style={{ padding: '6px 14px' }}>
        {zones.map(({ id, name, s }, i) => (
          <div key={id} style={{ padding: '13px 2px', borderBottom: i < zones.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => muteSpeaker(id, s.vol)}
                  style={{ ...iconBtn, opacity: s.on ? 1 : 0.35, color: (s.on && s.vol === 0) ? 'var(--accent)' : 'var(--text2)' }}>
                  <Icon name={s.on && s.vol > 0 ? 'volume' : 'mute'} size={18} />
                </button>
                <Toggle on={s.on} onChange={(v) => setD(id, { on: v, vol: v && !s.vol ? 30 : s.vol })} size={0.82} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Slider value={s.vol} onChange={(v) => setD(id, { vol: v, on: v > 0 })} height={30} disabled={!s.on} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', minWidth: 30, textAlign: 'right' }}>
                {s.on ? (s.vol === 0 ? 'Muted' : `${s.vol}%`) : '–'}
              </span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
