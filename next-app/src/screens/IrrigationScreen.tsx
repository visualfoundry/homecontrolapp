'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { LargeTitle } from '@/components/LargeTitle';
import { pillBtn } from '@/lib/styles';
import { deviceTag } from '@/lib/debug';
import type { IrrigationProgramState, IrrigationZoneState, FlagState } from '@/types/state';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Static schedule display (visual only — not backed by per-zone schedule state)
const SCHED = [
  { time: '6:30 am', run: [1, 1, 1, 1, 1, 1, 1] },
  { time: '2:30 pm', run: [0, 0, 0, 0, 0, 0, 0] },
  { time: '8:30 pm', run: [1, 1, 1, 1, 1, 1, 1] },
  { time: '9:00 pm', run: [0, 2, 0, 0, 2, 0, 2] },
];

function fmtMins(mins: number): string {
  return mins < 1 ? '0:30' : mins + ':00';
}

export function IrrigationScreen() {
  const { st, setD, config } = useHC();

  // Use schedule flag from settings state
  const schedOn = (st['sc-irr'] as FlagState | undefined)?.on ?? false;
  const skipOn = (st['sc-irr-skip'] as FlagState | undefined)?.on ?? false;

  return (
    <div>
      <LargeTitle title="Irrigation" sub={schedOn ? 'Schedule active' : 'Schedule off'} />

      <SectionTitle>Programs</SectionTitle>
      <Card pad={false}>
        {config.irrigationPrograms.map((p, i) => {
          const s = st[p.id] as IrrigationProgramState | undefined;
          return (
            <div key={p.id} data-control={deviceTag(p.name, p.id, config.controlStateIds)} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px',
              borderBottom: i < config.irrigationPrograms.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>{p.name}</span>
              <Toggle on={s?.on ?? false} onChange={(v) => setD(p.id, { on: v })} size={0.85} />
            </div>
          );
        })}
      </Card>

      {/* Schedule grid */}
      <div style={{ marginTop: 22 }}>
        <SectionTitle>Schedule</SectionTitle>
        <Card style={{ padding: '14px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7,1fr)', alignItems: 'center', gap: 4 }}>
            <span />
            {DAYS.map(d => (
              <span key={d} style={{ fontSize: 11, fontWeight: 640, color: 'var(--text2)', textAlign: 'center' }}>{d}</span>
            ))}
            {SCHED.map(row => (
              <React.Fragment key={row.time}>
                <span style={{ fontSize: 11.5, fontWeight: 560, color: 'var(--text2)' }}>{row.time}</span>
                {row.run.map((v, i) => (
                  <div key={i} style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {v > 0 && (
                      <span style={{ display: 'flex', color: v === 2 ? '#7bbf4a' : '#3fa535' }}>
                        <Icon name="grass" size={v === 2 ? 17 : 19} strokeWidth={2} />
                      </span>
                    )}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </Card>
        <div style={{ marginTop: 12 }}>
          <Card pad={false}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '0.5px solid var(--sep)' }}>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>Schedule On</span>
              <Toggle on={schedOn} onChange={(v) => setD('sc-irr', { on: v })} size={0.85} accent="#3fa535" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px' }}>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>Skip Schedule Today</span>
              <Toggle on={skipOn} onChange={(v) => setD('sc-irr-skip', { on: v })} size={0.85} />
            </div>
          </Card>
        </div>
      </div>

      {/* Zones */}
      <div style={{ marginTop: 22 }}>
        <SectionTitle>Zones</SectionTitle>
        <Card pad={false}>
          {config.irrigationZones.map((z, i) => {
            const s = st[z.id] as IrrigationZoneState | undefined;
            return (
              <div key={z.id} data-control={deviceTag(z.name, z.id, config.controlStateIds)} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px',
                borderBottom: i < config.irrigationZones.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--icon-bg)', color: '#3fa535',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                  <Icon name="droplet" size={19} />
                </div>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>{z.name}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text2)', marginRight: 12 }}>
                  {fmtMins(s?.mins ?? 0)}
                </span>
                <button
                  onClick={() => setD(z.id, {})}
                  style={{ ...pillBtn, background: 'var(--icon-bg)', color: 'var(--accent)', padding: '7px 14px' }}
                >
                  Run
                </button>
              </div>
            );
          })}
        </Card>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
