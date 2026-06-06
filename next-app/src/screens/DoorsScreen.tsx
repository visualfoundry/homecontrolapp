'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Toggle } from '@/components/Toggle';
import { Card, SectionTitle } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import { pillBtn } from '@/lib/styles';
import type { LockState, ContactSensorState, FlagState } from '@/types/state';

export function DoorsScreen() {
  const { st, setD, config } = useHC();
  const lockedCount = config.doorsExterior.filter(d => (st[d.id] as LockState | undefined)?.locked).length;
  const lockAll = () => config.doorsExterior.forEach(d => setD(d.id, { locked: true }));

  return (
    <div>
      <LargeTitle
        title="Doors"
        sub={`${lockedCount} of ${config.doorsExterior.length} exterior locked`}
        right={lockedCount < config.doorsExterior.length
          ? <button onClick={lockAll} style={pillBtn}>Lock All</button>
          : undefined}
      />

      <SectionTitle>Exterior</SectionTitle>
      <Card pad={false}>
        {config.doorsExterior.map((d, i) => {
          const locked = (st[d.id] as LockState | undefined)?.locked ?? true;
          const autoLock = d.autoLockId
            ? (st[d.autoLockId] as FlagState | undefined)?.on ?? false
            : undefined;
          return (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px',
              borderBottom: i < config.doorsExterior.length - 1 ? '0.5px solid var(--sep)' : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: locked ? 'rgba(52,168,83,0.12)' : 'rgba(224,72,61,0.12)',
                color: locked ? 'var(--green)' : 'var(--red)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={locked ? 'lock' : 'unlock'} size={20} />
              </div>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>{d.name}</span>
              {autoLock !== undefined && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginRight: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', letterSpacing: 0.3 }}>AUTO</span>
                  <Toggle on={autoLock} onChange={(v) => setD(d.autoLockId!, { on: v })} size={0.72} />
                </div>
              )}
              <button onClick={() => setD(d.id, { locked: !locked })} style={{
                border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 12px',
                fontSize: 13.5, fontWeight: 640,
                background: locked ? 'rgba(52,168,83,0.12)' : 'rgba(224,72,61,0.12)',
                color: locked ? 'var(--green)' : 'var(--red)',
                WebkitTapHighlightColor: 'transparent',
              }}>
                {locked ? 'Locked' : 'Unlocked'}
              </button>
            </div>
          );
        })}
      </Card>

      <div style={{ marginTop: 24 }}>
        <SectionTitle>Interior</SectionTitle>
        <Card pad={false}>
          {config.doorsInterior.map((d, i) => {
            const s = st[d.id] as ContactSensorState | undefined;
            const open = s?.open ?? false;
            return (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', padding: '14px 16px',
                borderBottom: i < config.doorsInterior.length - 1 ? '0.5px solid var(--sep)' : 'none',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, background: 'var(--icon-bg)',
                  color: open ? 'var(--amber)' : 'var(--text2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 13,
                }}>
                  <Icon name="door" size={20} />
                </div>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>{d.name}</span>
                {s?.lowBattery && (
                  <span style={{ color: 'var(--amber)', marginRight: 10, display: 'flex' }}>
                    <Icon name="battery" size={20} />
                  </span>
                )}
                <span style={{ fontSize: 14, fontWeight: 640, color: open ? 'var(--amber)' : 'var(--green)' }}>
                  {open ? 'Open' : 'Closed'}
                </span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
