'use client';

// =============================================================================
// RoomScreen — generic per-place page, opened from a scene tile's title.
// Aggregates every control located in `place` and renders each with the same
// component its source screen uses (parity guaranteed). Sections render only
// when non-empty, ordered: Lights Scene → Lights → Climate → Fans → Music →
// Doors → Car Doors.
// =============================================================================

import React from 'react';
import { useHC } from '@/lib/store';
import { Card, SectionTitle } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import { SceneRoomCard } from '@/components/SceneRoomCard';
import { LightRoomCard } from '@/components/LightRoomCard';
import { ClimateZoneCard } from '@/components/ClimateZoneCard';
import { FanCard } from '@/components/FanCard';
import { SpeakerRow } from '@/components/SpeakerRow';
import { ExteriorDoorRow } from '@/components/ExteriorDoorRow';
import { CarDoorTile } from '@/components/CarDoorTile';
import type { AutomationState, GlobalState } from '@/types/state';
import type { SceneRoomTypeKey, TimeOfDayKey } from '@/types/config';

export function RoomScreen({ place }: { place: string }) {
  const { st, config, prefs } = useHC();
  // Default to {} — guards against a config serialized before controlPlaces existed.
  const controlPlaces = config.controlPlaces ?? {};
  const inPlace = <T extends { id: string },>(items: T[]) =>
    items.filter(it => controlPlaces[it.id] === place);

  // Scene
  const sceneRoom = config.sceneRooms.find(r => r.place === place);
  const sceneAuto = sceneRoom ? (st['auto:' + sceneRoom.id] as AutomationState | undefined) : undefined;
  const tod = (st['_global'] as GlobalState).timeOfDay as TimeOfDayKey;
  const sceneLabel = sceneRoom
    ? (config.sceneSchedules[sceneRoom.type as SceneRoomTypeKey]?.[tod] ?? '—')
    : '';
  const hasScene = !!(sceneRoom && sceneAuto);

  // Lights for this place (lightRooms is already keyed by room/place name)
  const lightRoom = config.lightRooms.find(r => r.room === place);

  // Other device classes, filtered to this place
  const climate = inPlace(config.climate);
  const fans = inPlace(config.fans);
  const music = inPlace(config.musicZones);
  const doors = inPlace(config.doorsExterior);
  const carDoors = inPlace(config.garageCarDoors);

  return (
    <div>
      <LargeTitle title={place} />

      {hasScene && (
        <>
          <SectionTitle>Lights Scene</SectionTitle>
          <div style={{ marginBottom: 22 }}>
            <SceneRoomCard room={sceneRoom!} a={sceneAuto!} scene={sceneLabel}
              compact={prefs.sceneView === 'Compact'} />
          </div>
        </>
      )}

      {lightRoom && lightRoom.lights.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionTitle>Lights</SectionTitle>
          <LightRoomCard room={lightRoom} />
        </div>
      )}

      {climate.length > 0 && (
        <>
          <SectionTitle>Climate</SectionTitle>
          <div className="hca-tile-grid" style={{ marginBottom: 22 }}>
            {climate.map(c => <ClimateZoneCard key={c.id} zone={c} />)}
          </div>
        </>
      )}

      {fans.length > 0 && (
        <>
          <SectionTitle>Fans</SectionTitle>
          <div className="hca-tile-grid" style={{ marginBottom: 22 }}>
            {fans.map(f => <FanCard key={f.id} fan={f} />)}
          </div>
        </>
      )}

      {music.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionTitle>Music</SectionTitle>
          <Card pad={false} style={{ padding: '6px 14px' }}>
            {music.map((z, i) => <SpeakerRow key={z.id} zone={z} last={i === music.length - 1} />)}
          </Card>
        </div>
      )}

      {doors.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionTitle>Doors</SectionTitle>
          <Card pad={false}>
            {doors.map((d, i) => <ExteriorDoorRow key={d.id} door={d} last={i === doors.length - 1} />)}
          </Card>
        </div>
      )}

      {carDoors.length > 0 && (
        <>
          <SectionTitle>Garage Doors</SectionTitle>
          <div className="hca-tile-grid" style={{ marginBottom: 22 }}>
            {carDoors.map(d => <CarDoorTile key={d.id} door={d} />)}
          </div>
        </>
      )}
    </div>
  );
}
