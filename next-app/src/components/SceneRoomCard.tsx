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

// `steps` (2–6) makes the slider snap to discrete stops (N intervals / N+1
// stops incl. 0). Since % is meaningless per fitting, the readout shows the
// step (e.g. "2/4") rather than a percentage. Intensity is still stored 0–100.
function IntensityRow({ value, onChange, compact, steps }: {
  value: number; onChange: (v: number) => void; compact?: boolean; steps?: number;
}) {
  const stepped = !!steps && steps >= 2;
  const X = steps ?? 1;
  const idx = stepped ? Math.max(0, Math.min(X, Math.round((value / 100) * X))) : value;
  const sliderProps = stepped
    ? { value: idx, min: 0, max: X, step: 1, onChange: (i: number) => onChange(Math.round((i / X) * 100)) }
    : { value, min: 0, max: 100, step: 1, onChange };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <Slider {...sliderProps} icon={<Icon name="bulb" size={18} />} fill="var(--accent)" height={compact ? 34 : 38} />
      {!compact && (
        <span style={{ minWidth: 42, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
          fontSize: 15, fontWeight: 640, color: 'var(--text2)', letterSpacing: -0.3 }}>
          {stepped ? `${idx}/${X}` : `${value}%`}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SceneRoomCard
// ---------------------------------------------------------------------------

// Room name; clickable (→ that place's room page) when `place` is known.
function RoomTitle({ name, place, size, go }: {
  name: string; place?: string; size: number; go: (id: string) => void;
}) {
  const titleStyle: React.CSSProperties = {
    fontSize: size, fontWeight: size >= 17 ? 650 : 640, letterSpacing: -0.3, color: 'var(--text)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  };
  if (!place) return <div style={titleStyle}>{name}</div>;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); go(`room:${place}`); }}
      style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: '100%',
        border: 'none', background: 'none', padding: 0, cursor: 'pointer',
        color: 'var(--text3)', WebkitTapHighlightColor: 'transparent' }}>
      <span style={titleStyle}>{name}</span>
      <Icon name="chevron" size={size - 2} />
    </button>
  );
}

export function SceneRoomCard({ room, a, scene, compact }: {
  room: SceneRoomConfig;
  a: AutomationState;
  scene: string;
  compact?: boolean;
}) {
  const { setD, go } = useHC();
  const set = (patch: Partial<AutomationState>) => setD('auto:' + room.id, patch);
  const status = roomStatus(room, a, scene);
  const motionDisabled = !!room.doorId && !a.doorOpen;
  const controls = roomControls(room, a, motionDisabled);

  if (compact) {
    return (
      <Card pad={false} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 10px' }}>
          <span style={{ width: 9, height: 9, borderRadius: 5, background: status.dot, flex: '0 0 auto' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <RoomTitle name={room.name} place={room.place} size={16} go={go} />
          </div>
          {room.autoId !== undefined && <AutoPill on={a.automated} onTap={() => set({ automated: !a.automated })} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 13px' }}>
          <div style={{ flex: 1, opacity: a.automated ? 1 : 0.5 }}>
            <IntensityRow value={a.intensity} onChange={(v) => set({ intensity: v })} compact steps={room.steps} />
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
          <RoomTitle name={room.name} place={room.place} size={17} go={go} />
          <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status.label}</div>
        </div>
        <AutoPill on={a.automated} onTap={() => set({ automated: !a.automated })} />
      </div>
      <div style={{ padding: '0 15px 13px', opacity: a.automated ? 1 : 0.5 }}>
        <IntensityRow value={a.intensity} onChange={(v) => set({ intensity: v })} steps={room.steps} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 12px 13px' }}>
        {controls.map(({ key: ck, patch, ...rest }) => (
          <StateControl key={ck} {...rest} patch={patch} onTap={() => set(patch)} />
        ))}
      </div>
    </Card>
  );
}
