'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import { ExteriorDoorRow } from '@/components/ExteriorDoorRow';
import { pillBtn } from '@/lib/styles';
import { deviceTag } from '@/lib/debug';
import type { ContactSensorState } from '@/types/state';

// WP post titles carry a trailing " Open" suffix we don't want to show.
const doorName = (name: string) => name.replace(/\s+Open$/, '');

export function DoorsScreen() {
  const { st, setD, config } = useHC();
  const lockedCount = config.doorsExterior.filter(d => {
    const raw = st[d.id] as { locked?: boolean; value?: number } | undefined;
    return raw?.locked ?? (raw?.value !== undefined ? raw.value > 0 : false);
  }).length;
  const lockAll = () => config.doorsExterior.forEach(d => setD(d.id, { value: 1 }));

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
        {config.doorsExterior.map((d, i) => (
          <ExteriorDoorRow key={d.id} door={d} last={i === config.doorsExterior.length - 1} />
        ))}
      </Card>

      <div style={{ marginTop: 24 }}>
        <SectionTitle>Interior</SectionTitle>
        <Card pad={false}>
          {config.doorsInterior.map((d, i) => {
            const s = st[d.id] as ContactSensorState | undefined;
            const open = s?.open ?? false;
            return (
              <div key={d.id} data-control={deviceTag(d.name, d.id, config.controlStateIds)} style={{
                display: 'flex', alignItems: 'center', padding: '14px 16px',
                borderBottom: i < config.doorsInterior.length - 1 ? '0.5px solid var(--sep)' : 'none',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, background: 'var(--icon-bg)',
                  color: open ? 'var(--green)' : 'var(--amber)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 13,
                }}>
                  <Icon name={open ? 'doorOpen' : 'door'} size={20} />
                </div>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>{doorName(d.name)}</span>
                {s?.lowBattery && (
                  <span style={{ color: 'var(--amber)', marginRight: 10, display: 'flex' }}>
                    <Icon name="battery" size={20} />
                  </span>
                )}
                <span style={{ fontSize: 14, fontWeight: 640, color: open ? 'var(--green)' : 'var(--amber)' }}>
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
