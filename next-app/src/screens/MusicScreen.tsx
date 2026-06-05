'use client';

import React from 'react';
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

export function MusicScreen() {
  const { st, setD, config } = useHC();
  const playing = config.musicZones.filter(m => (st[m.id] as SpeakerState | undefined)?.on).length;

  return (
    <div>
      <LargeTitle title="Music" sub={`Shared as "Music House" · ${playing} playing`} />

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

      {/* Speaker list */}
      <SectionTitle>Speakers</SectionTitle>
      <Card pad={false} style={{ padding: '6px 14px' }}>
        {config.musicZones.map((m, i) => {
          const s = st[m.id] as SpeakerState | undefined;
          if (!s) return null;
          return (
            <div key={m.id} style={{ padding: '13px 2px', borderBottom: i < config.musicZones.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{m.name}</span>
                <Toggle
                  on={s.on}
                  onChange={(v) => setD(m.id, { on: v, vol: v && !s.vol ? 30 : s.vol })}
                  size={0.82}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ color: 'var(--text3)', display: 'flex' }}>
                  <Icon name={s.on && s.vol > 0 ? 'volume' : 'mute'} size={20} />
                </span>
                <Slider value={s.vol} onChange={(v) => setD(m.id, { vol: v, on: v > 0 })} height={30} disabled={!s.on} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', minWidth: 30, textAlign: 'right' }}>
                  {s.on ? s.vol : '–'}
                </span>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
