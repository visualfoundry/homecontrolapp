'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { ExteriorDoorRow } from '@/components/ExteriorDoorRow';
import { CarDoorTile } from '@/components/CarDoorTile';
import { SceneRoomCard } from '@/components/SceneRoomCard';
import { LargeTitle } from '@/components/LargeTitle';
import type { FlagState, LockState, ContactSensorState, AutomationState, GlobalState } from '@/types/state';
import type { SceneRoomTypeKey, TimeOfDayKey } from '@/types/config';

export function GarageScreen() {
  const { st, setD, config, prefs } = useHC();
  const cars = config.garageCars;
  const doors = config.garageDoors;
  const carDoors = config.garageCarDoors;
  const lockedCount = doors.filter(d => (st[d.id] as LockState | undefined)?.locked ?? true).length;

  const allCarsOpen = carDoors.length > 0
    && carDoors.every(d => (st[d.id] as ContactSensorState | undefined)?.open ?? false);
  const toggleAllCars = () => carDoors.forEach(d => setD(d.id, { open: !allCarsOpen }));

  // Garage light scene — rendered with the same tile as the Scenes page.
  const tod = (st['_global'] as GlobalState).timeOfDay as TimeOfDayKey;
  const sceneRoom = config.garageSceneId
    ? config.sceneRooms.find(r => r.id === config.garageSceneId)
    : undefined;
  const sceneAuto = sceneRoom ? (st['auto:' + sceneRoom.id] as AutomationState | undefined) : undefined;
  const sceneLabel = sceneRoom
    ? (config.sceneSchedules[sceneRoom.type as SceneRoomTypeKey]?.[tod] ?? '—')
    : '';
  const hasScene = !!(sceneRoom && sceneAuto);

  const hasAny = hasScene || doors.length > 0 || carDoors.length > 0 || cars.length > 0;

  return (
    <div>
      <LargeTitle title="Garage"
        sub={doors.length > 0
          ? `${lockedCount} of ${doors.length} door${doors.length > 1 ? 's' : ''} locked`
          : undefined} />

      {hasScene && (
        <>
          <SectionTitle>Lights Scene</SectionTitle>
          <div style={{ marginBottom: 22 }}>
            <SceneRoomCard room={sceneRoom!} a={sceneAuto!} scene={sceneLabel}
              compact={prefs.sceneView === 'Compact'} />
          </div>
        </>
      )}

      {carDoors.length > 0 && (
        <>
          <SectionTitle action={allCarsOpen ? 'Close all' : 'Open all'} onAction={toggleAllCars}>
            Garage Car Doors
          </SectionTitle>
          <div className="hca-tile-grid" style={{ marginBottom: 22 }}>
            {carDoors.map(d => <CarDoorTile key={d.id} door={d} />)}
          </div>
        </>
      )}

      {doors.length > 0 && (
        <>
          <SectionTitle>Garage Doors</SectionTitle>
          <div style={{ marginBottom: 22 }}>
            <Card pad={false}>
              {doors.map((d, i) => (
                <ExteriorDoorRow key={d.id} door={d} last={i === doors.length - 1} />
              ))}
            </Card>
          </div>
        </>
      )}

      {cars.length > 0 && (
        <>
          <SectionTitle>Cars</SectionTitle>
          <Card pad={false}>
            {cars.map((it, i) => {
              const s = st[it.id] as FlagState | undefined;
              return (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px',
                  borderBottom: i < cars.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>{it.name}</span>
                  <Toggle on={s?.on ?? false} onChange={(v) => setD(it.id, { on: v })} size={0.85} />
                </div>
              );
            })}
          </Card>
        </>
      )}

      {!hasAny && (
        <Card style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 18 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: 'var(--icon-bg)', color: 'var(--text2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="garage" size={23} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 640, color: 'var(--text)' }}>No garage controls yet</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 1 }}>
              Controls will appear here once configured.
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
