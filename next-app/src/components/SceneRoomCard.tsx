'use client';

// =============================================================================
// SceneRoomCard — per-room scene/automation card (Detailed + Compact variants).
// Shared by the Scenes screen and any screen that needs the same tile
// (e.g. the Garage page's Garage Lights Scene). Reads/writes auto:<roomId>.
// =============================================================================

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { Slider } from '@/components/Slider';
import type { AutomationState } from '@/types/state';
import type { SceneRoomConfig } from '@/types/config';

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

export function roomStatus(room: SceneRoomConfig, a: AutomationState, scene: string) {
  if (!a.automated) return { label: 'Automation disabled', dot: 'var(--text3)', tone: 'off' };
  if (room.doorId && !a.doorOpen) return { label: 'Door closed · motion paused', dot: '#5B7FE0', tone: 'door' };
  if (a.manual) return { label: 'Manual switch · resumes when motion stops', dot: 'var(--amber)', tone: 'manual' };
  if (a.motion) return { label: `${scene} · active now`, dot: 'var(--green)', tone: 'active' };
  return { label: `${scene} · waiting for motion`, dot: 'var(--text3)', tone: 'idle' };
}

export type Control = {
  key: string; icon: string; label: string; value: string;
  color: string; on: boolean; dim: boolean; patch: Partial<AutomationState>;
};

export function roomControls(room: SceneRoomConfig, a: AutomationState, motionDisabled: boolean): Control[] {
  const c: Control[] = [];
  if (room.motionId !== undefined) {
    c.push({ key: 'motion', icon: 'motion', label: 'Motion', value: a.motion ? 'Detected' : 'Clear',
      color: '#DD8A0A', on: a.motion, dim: motionDisabled, patch: { motion: !a.motion } });
  }
  if (room.doorId !== undefined) {
    c.push({ key: 'doorOpen', icon: 'door', label: 'Door', value: a.doorOpen ? 'Open' : 'Closed',
      color: '#5B7FE0', on: !a.doorOpen, dim: false, patch: { doorOpen: !a.doorOpen } });
  }
  if (room.switchId !== undefined) {
    c.push({ key: 'manual', icon: 'power', label: 'Switch', value: a.manual ? 'Manual' : 'Auto',
      color: 'var(--amber)', on: a.manual, dim: false, patch: { manual: !a.manual } });
  }
  if (room.nightDimId !== undefined) {
    c.push({ key: 'nightDim', icon: 'moon', label: 'Night LEDs', value: a.nightDim ? 'Dimmed' : 'Normal',
      color: '#7A5AE0', on: a.nightDim, dim: false, patch: { nightDim: !a.nightDim } });
  }
  return c;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AutoPill({ on, onTap }: { on: boolean; onTap: () => void }) {
  return (
    <button onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto',
      border: 'none', cursor: 'pointer', borderRadius: 999, padding: '7px 13px 7px 11px',
      fontSize: 13.5, fontWeight: 640, letterSpacing: -0.2,
      background: on ? 'var(--accent)' : 'var(--icon-bg)',
      color: on ? '#fff' : 'var(--text2)',
      WebkitTapHighlightColor: 'transparent', transition: 'all .18s',
    }}>
      <Icon name="power" size={15} strokeWidth={2.3} />{on ? 'Auto' : 'Off'}
    </button>
  );
}

function StateControl({ icon, label, value, color, on, dim, onTap }: Control & { onTap: () => void }) {
  return (
    <button onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
      border: 'none', cursor: 'pointer', borderRadius: 14, padding: '10px 12px',
      background: on ? color + '1f' : 'var(--icon-bg)', opacity: dim ? 0.5 : 1,
      WebkitTapHighlightColor: 'transparent', transition: 'background .18s, opacity .18s',
    }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, flex: '0 0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: on ? color : 'var(--card)', color: on ? '#fff' : 'var(--text3)',
        boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--sep)', transition: 'all .18s' }}>
        <Icon name={icon as any} size={19} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 11.5, fontWeight: 560, color: 'var(--text2)', letterSpacing: 0.1, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: 14.5, fontWeight: 640, color: on ? color : 'var(--text3)', letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{value}</span>
      </span>
    </button>
  );
}

function CompactControl({ icon, color, on, dim, onTap, title }: Omit<Control, 'key'|'label'|'value'|'patch'> & { onTap: () => void; title: string }) {
  return (
    <button onClick={onTap} title={title} style={{
      width: 38, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer', flex: '0 0 auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: on ? color : 'var(--icon-bg)', color: on ? '#fff' : 'var(--text3)',
      opacity: dim ? 0.45 : 1, boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--sep)',
      transition: 'all .18s', WebkitTapHighlightColor: 'transparent',
    }}>
      <Icon name={icon as any} size={19} />
    </button>
  );
}

function IntensityRow({ value, onChange, compact }: { value: number; onChange: (v: number) => void; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <Slider value={value} onChange={onChange} min={0} max={100}
        icon={<Icon name="bulb" size={18} />} fill="var(--accent)" height={compact ? 34 : 38} />
      {!compact && (
        <span style={{ minWidth: 42, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
          fontSize: 15, fontWeight: 640, color: 'var(--text2)', letterSpacing: -0.3 }}>{value}%</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SceneRoomCard
// ---------------------------------------------------------------------------

export function SceneRoomCard({ room, a, scene, compact }: {
  room: SceneRoomConfig;
  a: AutomationState;
  scene: string;
  compact?: boolean;
}) {
  const { setD } = useHC();
  const set = (patch: Partial<AutomationState>) => setD('auto:' + room.id, patch);
  const status = roomStatus(room, a, scene);
  const motionDisabled = !!room.doorId && !a.doorOpen;
  const controls = roomControls(room, a, motionDisabled);

  if (compact) {
    return (
      <Card pad={false} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 10px' }}>
          <span style={{ width: 9, height: 9, borderRadius: 5, background: status.dot, flex: '0 0 auto' }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 640, letterSpacing: -0.3, color: 'var(--text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.name}</div>
          {room.autoId !== undefined && <AutoPill on={a.automated} onTap={() => set({ automated: !a.automated })} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 13px' }}>
          <div style={{ flex: 1, opacity: a.automated ? 1 : 0.5 }}>
            <IntensityRow value={a.intensity} onChange={(v) => set({ intensity: v })} compact />
          </div>
          <div style={{ display: 'flex', gap: 7, flex: '0 0 auto' }}>
            {controls.map(c => (
              <CompactControl key={c.key} icon={c.icon} color={c.color} on={c.on}
                dim={!a.automated || c.dim} title={`${c.label}: ${c.value}`}
                onTap={() => set(c.patch)} />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card pad={false} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 15px 12px' }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: status.dot, flex: '0 0 auto',
          boxShadow: status.tone === 'active' ? '0 0 0 4px rgba(52,168,83,0.16)' : 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 650, letterSpacing: -0.3, color: 'var(--text)' }}>{room.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status.label}</div>
        </div>
        <AutoPill on={a.automated} onTap={() => set({ automated: !a.automated })} />
      </div>
      <div style={{ padding: '0 15px 13px', opacity: a.automated ? 1 : 0.5 }}>
        <IntensityRow value={a.intensity} onChange={(v) => set({ intensity: v })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 12px 13px' }}>
        {controls.map(({ key: ck, patch, ...rest }) => (
          <StateControl key={ck} {...rest} patch={patch} onTap={() => set(patch)} />
        ))}
      </div>
    </Card>
  );
}
