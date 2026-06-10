'use client';

// =============================================================================
// CarDoorTile — garage car door (open/closed), illuminated amber when open.
// Shared by the Garage screen, Home favorites, and the per-place Room screen.
// =============================================================================

import React from 'react';
import { useHC } from '@/lib/store';
import { Tile } from '@/components/Tile';
import type { ContactSensorState } from '@/types/state';
import type { SettingItem } from '@/types/config';

export function CarDoorTile({ door, compact }: { door: SettingItem; compact?: boolean }) {
  const { st, setD } = useHC();
  const open = (st[door.id] as ContactSensorState | undefined)?.open ?? false;
  return (
    <Tile
      icon="garage"
      name={door.name}
      status={open ? 'Open' : 'Closed'}
      active={open}
      activeColor="var(--amber)"
      glow
      compact={compact}
      onTap={() => setD(door.id, { open: !open })}
    />
  );
}
