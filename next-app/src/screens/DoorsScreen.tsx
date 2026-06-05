'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Tile } from '@/components/Tile';
import { Toggle } from '@/components/Toggle';
import { Card, SectionTitle } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import { pillBtn } from '@/lib/styles';
import type { LockState, ContactSensorState } from '@/types/state';

export function DoorsScreen() {
  const { st, setD, config } = useHC();
  const lockedCount = config.doorsExterior.filter(d => (st[d.id] as LockState | undefined)?.locked).length;
  const lockAll = () => config.doorsExterior.forEach(d => setD(d.id, { locked: true }));

  return (
    <div>
      <LargeTitle
        title="Doors"
        sub={`${lockedCount} of ${config.doorsExterior.length} exterior doors locked`}
        right={lockedCount < config.doorsExterior.length
          ? <button onClick={lockAll} style={pillBtn}>Lock All</button>
          : undefined}
      />

      <SectionTitle>Exterior</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {config.doorsExterior.map(d => {
          const locked = (st[d.id] as LockState | undefined)?.locked ?? true;
          const toggle = () => setD(d.id, { locked: !locked });
          return (
            <Tile key={d.id} icon={locked ? 'lock' : 'unlock'} name={d.name}
              status={locked ? 'Locked' : 'Unlocked'} active={true}
              activeColor={locked ? 'var(--green)' : 'var(--red)'} onTap={toggle}
              control={<Toggle on={locked} onChange={toggle} accent="rgba(255,255,255,0.45)" size={0.78} />} />
          );
        })}
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionTitle>Interior · Sensors</SectionTitle>
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
