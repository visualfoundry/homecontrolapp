'use client';

// =============================================================================
// ExteriorDoorRow — a single exterior-door lock row (lock/unlock + auto-lock).
// Shared by the Doors screen and the Garage screen so they render identically.
// Wrap rows in a <Card pad={false}>; pass `last` to drop the bottom separator.
// =============================================================================

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Toggle } from '@/components/Toggle';
import type { ExteriorDoor } from '@/types/config';
import type { LockState, FlagState } from '@/types/state';

// WP post titles carry a trailing " Open" suffix we don't want to show.
const doorName = (name: string) => name.replace(/\s+Open$/, '');

export function ExteriorDoorRow({ door, last }: { door: ExteriorDoor; last?: boolean }) {
  const { st, setD } = useHC();
  const locked = (st[door.id] as LockState | undefined)?.locked ?? true;
  const autoLock = door.autoLockId
    ? (st[door.autoLockId] as FlagState | undefined)?.on ?? false
    : undefined;
  // Open/closed sensor: locked=true → DON fired → door is physically open
  const openState = door.openId ? (st[door.openId] as LockState | undefined) : undefined;
  const open = openState?.locked ?? false;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px',
      borderBottom: last ? 'none' : '0.5px solid var(--sep)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: door.openId
          ? (open ? 'rgba(52,168,83,0.12)' : 'rgba(255,165,0,0.12)')
          : (locked ? 'rgba(52,168,83,0.12)' : 'rgba(224,72,61,0.12)'),
        color: door.openId
          ? (open ? 'var(--green)' : 'var(--amber)')
          : (locked ? 'var(--green)' : 'var(--red)'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={door.openId ? 'door' : (locked ? 'lock' : 'unlock')} size={20} />
      </div>
      <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>{doorName(door.name)}</span>
      {autoLock !== undefined && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginRight: 8 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', letterSpacing: 0.3 }}>AUTO</span>
          <Toggle on={autoLock} onChange={(v) => setD(door.autoLockId!, { on: v })} size={0.72} />
        </div>
      )}
      <button onClick={() => setD(door.id, { locked: !locked })} style={{
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
}
