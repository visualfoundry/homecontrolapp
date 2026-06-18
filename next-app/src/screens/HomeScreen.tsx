'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Tile } from '@/components/Tile';
import { Toggle } from '@/components/Toggle';
import { Card, SectionTitle } from '@/components/Card';
import { Segmented } from '@/components/Segmented';
import { Avatar } from '@/components/Avatar';
import { getAvatarPhoto, setAvatarPhoto } from '@/lib/avatar-photos';
import { LargeTitle } from '@/components/LargeTitle';
import { iconBtn, pillBtn, stepBtn } from '@/lib/styles';
import { Slider } from '@/components/Slider';
import { SceneRoomCard } from '@/components/SceneRoomCard';
import { speakerName } from '@/components/SpeakerRow';
import { CarDoorTile } from '@/components/CarDoorTile';
import type { LightState, LockState, ContactSensorState, SpeakerState, FanState, FlagState, GlobalState, FavsState, ScenesListState, PoolState, PoolNodeState, AutomationState, VariableState, TextVariableState, WeatherCondition, ThermostatState } from '@/types/state';

// Map a raw weather-conditions string (any source wording) to a visual bucket.
function mapCondition(text: string): WeatherCondition {
  const t = text.toLowerCase();
  if (/(rain|shower|drizzle|storm|thunder)/.test(t)) return 'Rain';
  if (/(snow|sleet|flurr|ice|hail)/.test(t)) return 'Snow';
  if (/(cloud|overcast|fog|mist|haze)/.test(t)) return 'Cloudy';
  return 'Clear';
}
import type { SceneRoomTypeKey, TimeOfDayKey, ClimateZone } from '@/types/config';
import { deviceTag } from '@/lib/debug';

// ── Scrollable stat pill ──────────────────────────────────────────────────────
function StatTile({ icon, label, value, tint, onTap, compact, active, 'data-control': dataControl }: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string | number;
  tint: string;
  onTap?: () => void;
  compact?: boolean;
  active?: boolean;
  'data-control'?: string;
}) {
  return (
    <div onClick={onTap} data-control={dataControl} style={{
      background: compact ? (active ? tint : 'var(--card)') : 'var(--card)',
      borderRadius: 18, boxShadow: active ? 'none' : 'var(--shadow)',
      padding: '14px 16px 12px', flex: '0 0 auto',
      width: compact ? 104 : undefined, minWidth: compact ? undefined : 128,
      cursor: onTap ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      gap: compact ? 16 : 0, transition: 'background .2s',
    }}>
      <div style={{
        width: compact ? 38 : 30, height: compact ? 38 : 30,
        borderRadius: compact ? 11 : 9,
        background: compact ? (active ? 'rgba(255,255,255,0.25)' : tint + '1f') : tint + '22',
        color: compact ? (active ? '#fff' : tint) : tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: compact ? 0 : 9,
      }}>
        <Icon name={icon} size={compact ? 21 : 18} strokeWidth={2} />
      </div>
      {!compact && <div style={{ fontSize: 21, fontWeight: 720, color: 'var(--text)', letterSpacing: -0.5 }}>{value}</div>}
      <div style={{
        fontSize: compact ? 13.5 : 12.5,
        color: compact ? (active ? '#fff' : 'var(--text)') : 'var(--text2)',
        fontWeight: compact ? 600 : 500, marginTop: compact ? 0 : 1, letterSpacing: -0.2,
      }}>{label}</div>
    </div>
  );
}

// ── Fav tiles (defined outside HomeScreen to preserve component identity across renders) ──

function FavTile({ id, icon, label }: { id: string; icon: React.ComponentProps<typeof Icon>['name']; label: string }) {
  const { st, setD, config } = useHC();
  const s = st[id] ?? { on: false, level: 0 };
  const isDoor = 'locked' in s;
  const isContact = 'open' in s;
  const isLight = !isDoor && !isContact && ('level' in s || icon === 'bulb');
  const on = isDoor ? (s as LockState).locked
    : isContact ? (s as ContactSensorState).open
    : (s as { on?: boolean }).on ?? false;
  const toggle = () => {
    if (isDoor) setD(id, { locked: !(s as LockState).locked });
    else if (isContact) setD(id, { open: !(s as ContactSensorState).open });
    else if (isLight) { const ls = s as LightState; setD(id, { on: !ls.on, level: !ls.on ? (ls.level || 100) : (ls.level ?? 100) }); }
    else setD(id, { on: !(s as { on: boolean }).on });
  };
  const status = isDoor
    ? ((s as LockState).locked ? 'Locked' : 'Unlocked')
    : isContact ? ((s as ContactSensorState).open ? 'Open' : 'Closed')
    : isLight ? ((s as LightState).on ? `On · ${(s as LightState).level}%` : 'Off')
    : ((s as { on: boolean }).on ? 'On' : 'Off');
  const color = isDoor
    ? ((s as LockState).locked ? 'var(--green)' : 'var(--red)')
    : isContact ? 'var(--amber)'
    : isLight ? 'var(--amber)' : 'var(--accent)';
  const icn: React.ComponentProps<typeof Icon>['name'] =
    isDoor ? ((s as LockState).locked ? 'lock' : 'unlock') : icon;
  return (
    <Tile icon={icn} name={label} status={status} active={on} activeColor={color}
      glow={isLight} onTap={toggle} compact
      data-control={deviceTag(label, id, config.controlStateIds)}
      control={<Toggle on={on} onChange={toggle} accent="rgba(255,255,255,0.4)" size={0.72} />} />
  );
}

function LightFavTile({ id, label }: { id: string; label: string }) {
  const { st, setD, config } = useHC();
  const s = (st[id] as LightState | undefined) ?? { on: false, level: 0 };
  const snap = config.lightRooms.flatMap(r => r.lights).find(l => l.id === id)?.kind === 'switch';
  const [dragLevel, setDragLevel] = React.useState<number | null>(null);
  const displayLevel = dragLevel ?? (s.on ? s.level : 0);
  const onDrag = (level: number) => setDragLevel(snap ? (level >= 50 ? 100 : 0) : level);
  const onCommit = (level: number) => {
    const v = snap ? (level >= 50 ? 100 : 0) : level;
    setDragLevel(null);
    setD(id, { level: v, on: v > 0 });
  };
  const toggle = () => setD(id, { on: !s.on, level: !s.on ? 100 : 0 });
  return (
    <div data-control={deviceTag(label, id, config.controlStateIds)} style={{ gridColumn: 'span 2', position: 'relative', height: 96, borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--slider-track)', touchAction: 'none', userSelect: 'none' }}>
      <Slider value={displayLevel} onChange={onDrag} onCommit={onCommit} height={96} track="transparent" fill="linear-gradient(90deg,#f5b942,#ffd86b)" />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span onClick={toggle} style={{ pointerEvents: 'auto', cursor: 'pointer', color: s.on ? '#8a5a00' : 'var(--text3)', display: 'flex' }}>
            <Icon name="bulb" size={21} strokeWidth={1.9} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: s.on ? '#5c3d00' : 'var(--text)', letterSpacing: -0.2 }}>{label}</span>
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: s.on ? '#7a5200' : 'var(--text3)' }}>
          {s.on ? (snap ? '100%' : `${displayLevel}%`) : 'Off'}
        </span>
      </div>
    </div>
  );
}

function FanFavTile({ id, label }: { id: string; label: string }) {
  const { st, setD, config } = useHC();
  const s = (st[id] as FanState | undefined) ?? { on: false, speed: 0 as FanState['speed'] };
  const SPEEDS = ['Off', 'Low', 'Med', 'High'] as const;
  const setSpeed = (sp: number) => setD(id, { speed: sp as FanState['speed'], on: sp > 0 });
  const spinDuration = s.on ? `${1.4 - s.speed * 0.3}s` : undefined;
  return (
    <div data-control={deviceTag(label, id, config.controlStateIds)} style={{ gridColumn: 'span 2' }}>
      <Card style={{ padding: '12px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: s.on ? 'var(--accent)' : 'var(--icon-bg)', color: s.on ? '#fff' : 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ display: 'flex', animation: s.on ? `spin ${spinDuration} linear infinite` : 'none' }}>
                <Icon name="fan" size={20} />
              </span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 620, color: 'var(--text)', letterSpacing: -0.2 }}>{label}</span>
          </div>
          <Toggle on={s.on} onChange={(v) => setD(id, { on: v, speed: v ? Math.max(1, s.speed) as FanState['speed'] : 0 })} size={0.78} />
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--seg-bg)', borderRadius: 10, padding: 3 }}>
          {SPEEDS.map((sp, idx) => (
            <button key={sp} onClick={() => setSpeed(idx)} style={{
              flex: 1, border: 'none', cursor: 'pointer', borderRadius: 7, padding: '5px 0',
              fontSize: 11.5, fontWeight: 620,
              background: s.speed === idx ? 'var(--seg-active)' : 'transparent',
              color: s.speed === idx ? 'var(--text)' : 'var(--text3)',
              boxShadow: s.speed === idx ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
              WebkitTapHighlightColor: 'transparent',
            }}>{sp}</button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SpeakerFavTile({ id, label }: { id: string; label: string }) {
  const { st, setD, config } = useHC();
  const s = (st[id] as SpeakerState | undefined) ?? { on: false, vol: 0 };
  const [dragVol, setDragVol] = React.useState<number | null>(null);
  const pct = dragVol ?? (s.on ? s.vol : 0);
  const toggle = () => setD(id, { on: !s.on, vol: !s.on ? (s.vol || 30) : s.vol });
  const name = speakerName(label);
  return (
    <div data-control={deviceTag(label, id, config.controlStateIds)} style={{ gridColumn: 'span 2' }}>
      <Card style={{ padding: '12px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: s.on ? '#6a4a7a' : 'var(--icon-bg)', color: s.on ? '#fff' : 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .18s, color .18s' }}>
              <Icon name="speaker" size={19} strokeWidth={1.9} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 620, color: 'var(--text)', letterSpacing: -0.2 }}>{name}</span>
          </div>
          <Toggle on={s.on} onChange={toggle} size={0.78} />
        </div>
        <Slider
          value={pct}
          onChange={setDragVol}
          onCommit={(v) => { setDragVol(null); setD(id, { vol: v, on: v > 0 }); }}
          height={32}
          fill="linear-gradient(90deg,#6a4a7a,#9b6ab0)"
          icon={<Icon name="speaker" size={15} strokeWidth={1.9} />}
        />
      </Card>
    </div>
  );
}

function SceneFavTile({ id }: { id: string; label: string }) {
  const { st, config } = useHC();
  const room = config.sceneRooms.find(r => r.id === id);
  const a = st[`auto:${id}`] as AutomationState | undefined;
  if (!room || !a) return null;
  const tod = (st['_global'] as GlobalState).timeOfDay as TimeOfDayKey;
  const scene = config.sceneSchedules[room.type as SceneRoomTypeKey]?.[tod] ?? '—';
  return (
    <div data-control={deviceTag(room.name, id, config.controlStateIds)} style={{ gridColumn: 'span 2' }}>
      <SceneRoomCard room={room} a={a} scene={scene} compact />
    </div>
  );
}

function MiniClimateZoneTile({ zone }: { zone: ClimateZone }) {
  const { st, setD, go, config } = useHC();
  const s = (st[zone.id] as ThermostatState | undefined)
    ?? { temp: 72, mode: 'auto' as const, lo: 68, hi: 76 };
  const col = s.mode === 'cool' ? '#3d9be0'
    : s.mode === 'heat' ? '#e0573d'
    : s.mode === 'off'  ? 'var(--text3)'
    : '#e0883d';
  const setpoint = s.mode === 'heat' ? `${s.lo}°`
    : s.mode === 'cool' ? `${s.hi}°`
    : s.mode === 'auto' ? `${s.lo}°–${s.hi}°`
    : '—';
  const runLabel = s.running === 'cooling' ? 'Cooling'
    : s.running === 'heating' ? 'Heating'
    : null;
  const modeLabel = s.mode === 'off' ? 'Off'
    : s.mode.charAt(0).toUpperCase() + s.mode.slice(1);
  const canNudge = s.mode !== 'off';
  const nudge = (d: number) => {
    const round = (v: number) => Math.round(v * 2) / 2;
    if (s.mode === 'heat') setD(zone.id, { lo: round(s.lo + d) });
    else if (s.mode === 'cool') setD(zone.id, { hi: round(s.hi + d) });
    else if (s.mode === 'auto') setD(zone.id, { lo: round(s.lo + d), hi: round(s.hi + d) });
  };
  return (
    <div data-control={deviceTag(zone.name, zone.id, config.controlStateIds)} onClick={() => go('climate')} style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: 12, borderRadius: 'var(--radius)', background: 'var(--card)',
      boxShadow: 'var(--shadow)', minHeight: 110, cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent', overflow: 'hidden',
    }}>
      {/* Top: icon + name/status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: s.mode === 'off' ? 'var(--icon-bg)' : col + '22',
          color: col, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="thermo" size={18} strokeWidth={1.9} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 640, color: 'var(--text)', letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{zone.name}</div>
          <div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 2, color: runLabel ? col : 'var(--text2)' }}>
            {runLabel ?? modeLabel}
          </div>
        </div>
      </div>
      {/* Bottom: [− setpoint +]   current temp */}
      <div onClick={e => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={(e) => { e.stopPropagation(); nudge(-0.5); }}
            disabled={!canNudge} style={{ ...stepBtn, width: 30, height: 30, borderRadius: 15, opacity: canNudge ? 1 : 0.3 }}>
            <Icon name="minus" size={15} strokeWidth={2.4} />
          </button>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', letterSpacing: -0.2 }}>{setpoint}</span>
          <button onClick={(e) => { e.stopPropagation(); nudge(0.5); }}
            disabled={!canNudge} style={{ ...stepBtn, width: 30, height: 30, borderRadius: 15, opacity: canNudge ? 1 : 0.3 }}>
            <Icon name="plus" size={15} strokeWidth={2.4} />
          </button>
        </div>
        <div style={{ fontSize: 26, fontWeight: 300, color: 'var(--text)', letterSpacing: -1 }}>{s.temp}°</div>
      </div>
    </div>
  );
}

// ── PersonAvatar ─────────────────────────────────────────────────────────────
// Avatar with localStorage photo support. Tap = toggle presence.
// Long-press (600ms) = open photo picker to set/replace photo.

function PersonAvatar({ id, name, present, onToggle }: {
  id: string; name: string; present: boolean; onToggle: () => void;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => getAvatarPhoto(id));
  const fileRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  // Sync photo when id changes (e.g. config reload)
  useEffect(() => { setPhotoUrl(getAvatarPhoto(id)); }, [id]);

  const startLongPress = () => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      fileRef.current?.click();
    }, 600);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleClick = () => {
    if (!didLongPress.current) onToggle();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatarPhoto(id, dataUrl);
      setPhotoUrl(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div style={{ flex: '0 0 auto', width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
      <div style={{ position: 'relative' }}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onClick={handleClick}>
        <Avatar name={name} present={present} photoUrl={photoUrl} />
        {/* Small camera badge hint */}
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 16, height: 16, borderRadius: '50%',
          background: 'var(--card)', border: '1.5px solid var(--sep)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <Icon name="camera" size={9} strokeWidth={2} />
        </div>
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 560, color: present ? 'var(--text)' : 'var(--text3)' }}>
        {name.split(' ')[0]}
      </span>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
}

export function HomeScreen() {
  const { st, setD, go, config } = useHC();
  const global = st['_global'] as GlobalState;

  // Derive tod from the House Status variable (1=Morning, 2=Day, 3=Evening, 4=Night).
  // Falls back to _global.timeOfDay if the variable isn't wired.
  const TOD_VALUES: TimeOfDayKey[] = ['Morning', 'Day', 'Evening', 'Night'];
  const hsVal = config.houseStatusId
    ? (st[config.houseStatusId] as { value?: number } | undefined)?.value
    : undefined;
  const tod: TimeOfDayKey = (hsVal != null && hsVal >= 1 && hsVal <= 4)
    ? TOD_VALUES[hsVal - 1]
    : global.timeOfDay;

  const setTod = (v: string) => {
    const idx = TOD_VALUES.indexOf(v as TimeOfDayKey);
    if (config.houseStatusId && idx >= 0) {
      setD(config.houseStatusId, { value: idx + 1 });
    }
    setD('_global', { timeOfDay: v as TimeOfDayKey });
  };

  const climateRaw = config.houseClimateId
    ? (st[config.houseClimateId] as { value?: number } | undefined)?.value
    : undefined;
  const climateMode = climateRaw === 2 ? 'Away' : climateRaw === 3 ? 'Sleep' : 'Home';
  const setClimateMode = (m: string) => {
    if (config.houseClimateId) {
      setD(config.houseClimateId, { value: m === 'Away' ? 2 : m === 'Sleep' ? 3 : 1 });
    }
  };
  const [activeScene, setActiveScene] = useState<string | null>(null);

  const lightsOn = config.lightRooms.reduce((n, r) =>
    n + r.lights.filter(l => (st[l.id] as LightState | undefined)?.on).length, 0);
  const doorsLocked = config.doorsExterior.filter(d => (st[d.id] as LockState | undefined)?.locked).length;
  const peopleHome = config.people.filter(p => (st[p.id] as FlagState | undefined)?.on).length;
  const motionAlerts = config.motionSensors.filter(s => {
    const rec = st[s.id] as { motion?: boolean } | undefined;
    return rec?.motion;
  }).length;
  const avgTemp = config.climate.length
    ? (config.climate.reduce((sum, c) => sum + ((st[c.id] as { temp?: number } | undefined)?.temp ?? 72), 0) / config.climate.length).toFixed(1)
    : '–';
  const numVar = (id: string | null) => (id ? (st[id] as VariableState | undefined)?.value : undefined);
  const varOn  = (id: string | null) => {
    const n = id ? (st[id] as Record<string, unknown> | undefined) : undefined;
    const v = (n as { value?: number } | undefined)?.value;
    if (v !== undefined) return v > 0;
    return (n as { on?: boolean } | undefined)?.on ?? false;
  };
  const poolTemp    = numVar(config.poolNodeId) ?? (st['pool'] as PoolState | undefined)?.poolTemp ?? 0;
  const poolPumpOn  = varOn(config.poolPumpNodeId);
  const poolPumpSpd = numVar(config.poolPumpSpeedId);
  const poolHeatOn  = varOn(config.poolHeaterId);
  const poolStatus  = poolHeatOn
    ? (poolPumpOn ? `Heater on · ${poolPumpSpd ?? '–'}%` : 'Heater on')
    : poolPumpOn ? `Pump · ${poolPumpSpd ?? '–'}%` : 'Idle';
  const rawPh   = numVar(config.poolPhId);
  const poolPh  = rawPh !== undefined ? (rawPh > 14 ? rawPh / 10 : rawPh) : null;
  const phStatus = poolPh !== null ? (poolPh < 7.2 ? 'Low' : poolPh > 7.8 ? 'High' : 'Ideal') : null;
  const phTint   = phStatus === 'Ideal' ? 'var(--green)' : phStatus !== null ? 'var(--red)' : '#5a9bd4';
  const weatherTemp = numVar(config.weatherTempId);
  const weatherHigh = numVar(config.weatherHighId);
  const weatherLow  = numVar(config.weatherLowId);

  // Weather conditions come from a hub variable; map its text to a visual bucket.
  const condRaw = config.weatherCondId
    ? (st[config.weatherCondId] as TextVariableState | undefined)?.text
    : undefined;
  const cond = condRaw ? mapCondition(condRaw) : global.weather;
  const skyDark = tod === 'Night';
  const clearSky: Record<string, string> = {
    Morning: 'linear-gradient(160deg,#ffd9a8 0%,#ffc1a0 35%,#a8c8e8 100%)',
    Day:     'linear-gradient(160deg,#5fa8e8 0%,#8fc6f0 50%,#cfe8f5 100%)',
    Evening: 'linear-gradient(160deg,#f6a96b 0%,#e07b8a 50%,#7b6aa8 100%)',
    Night:   'linear-gradient(160deg,#1e2a4a 0%,#2d3a5c 55%,#46537a 100%)',
  };
  const condDay: Record<string, string> = {
    Cloudy: 'linear-gradient(160deg,#9aa6b2 0%,#c6ced8 100%)',
    Rain:   'linear-gradient(160deg,#5f6b78 0%,#94a0ac 100%)',
    Snow:   'linear-gradient(160deg,#aeb8c4 0%,#e2e9f0 100%)',
  };
  const sky = cond === 'Clear'
    ? (clearSky[tod] ?? clearSky.Day)
    : skyDark ? 'linear-gradient(160deg,#20252c 0%,#39414b 100%)' : (condDay[cond] ?? condDay.Cloudy);
  const darkText = skyDark || cond === 'Rain';
  const wIcon: React.ComponentProps<typeof Icon>['name'] =
    cond === 'Clear' ? (skyDark ? 'moon' : 'sun') : cond === 'Cloudy' ? 'cloud' : cond === 'Rain' ? 'rain' : 'snow';
  const wLabel = condRaw ?? cond;
  const hiLo = `L:${weatherLow != null ? Math.round(weatherLow) : '–'}° H:${weatherHigh != null ? Math.round(weatherHigh) : '–'}°`;
  const cycleWeather = () => {
    const seq: GlobalState['weather'][] = ['Clear', 'Cloudy', 'Rain', 'Snow'];
    const next = seq[(seq.indexOf(cond) + 1) % seq.length];
    // Drive the conditions variable when present (mock toggle), else ambient state.
    if (config.weatherCondId) setD(config.weatherCondId, { text: next });
    else setD('_global', { weather: next });
  };

  const sceneIds = (st['_scenes'] as ScenesListState).ids;
  const favIds   = (st['_favs']   as FavsState).ids;

  // Auto-seed: any env control not yet in sceneIds gets appended once.
  React.useEffect(() => {
    const missing = config.environmentalControls.filter(e => !sceneIds.includes(e.id));
    if (missing.length > 0) setD('_scenes', { ids: [...sceneIds, ...missing.map(e => e.id)] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.environmentalControls.map(e => e.id).join(',')]);
  const sceneById = Object.fromEntries(config.scenes.map(s => [s.id, s]));
  const envById   = Object.fromEntries(config.environmentalControls.map(e => [e.id, e]));
  const favLookup = Object.fromEntries(config.favCatalog.flatMap(g => g.items.map(it => [it.id, it])));
  const lightSceneIds = new Set(config.lightSceneRooms.map(r => r.id));
  const carDoorIds = new Set(config.garageCarDoors.map(d => d.id));

  const greeting = (() => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    if (h >= 17 && h < 21) return 'Good evening';
    return 'Good night';
  })();

  return (
    <div>
      <LargeTitle title={greeting} sub="The House"
        right={
          <button onClick={() => go('settings')} style={iconBtn}>
            <Icon name="gear" size={22} />
          </button>
        } />

      {/* Weather card */}
      <div style={{ padding: '0 0 4px' }}>
        <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)', background: sky, position: 'relative' }}>
          {(cond === 'Rain' || cond === 'Snow') && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 152, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
              {Array.from({ length: cond === 'Rain' ? 22 : 16 }).map((_, i) => (
                <span key={i} style={cond === 'Rain' ? {
                  position: 'absolute', left: `${(i * 4.7) % 100}%`, top: 0, width: 1.6, height: 15,
                  background: 'rgba(255,255,255,0.6)', borderRadius: 2,
                  animation: `rainfall ${0.55 + (i % 5) * 0.1}s linear ${(i % 8) * 0.11}s infinite`,
                } : {
                  position: 'absolute', left: `${(i * 6.3) % 100}%`, top: 0, width: 6, height: 6, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.9)',
                  animation: `snowfall ${2.4 + (i % 5) * 0.5}s linear ${(i % 8) * 0.3}s infinite`,
                }} />
              ))}
            </div>
          )}
          <div style={{ padding: 18, color: darkText ? '#fff' : '#1f3047', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.85 }}>The House</div>
                <div style={{ fontSize: 46, fontWeight: 300, letterSpacing: -2, lineHeight: 1, marginTop: 6 }}>{weatherTemp != null ? `${Math.round(weatherTemp)}°` : '–'}</div>
                <div style={{ fontSize: 13.5, fontWeight: 500, opacity: 0.85, marginTop: 4 }}>{wLabel} · {hiLo}</div>
              </div>
              <button onClick={cycleWeather} style={{
                background: 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer',
                width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: darkText ? '#fff' : '#1f3047', WebkitTapHighlightColor: 'transparent',
              }}>
                <Icon name={wIcon} size={32} strokeWidth={1.7} />
              </button>
            </div>
          </div>
          <div style={{ padding: 10, background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(6px)', position: 'relative', zIndex: 1 }}>
            <Segmented options={['Morning', 'Day', 'Evening', 'Night']} value={tod} onChange={setTod} />
          </div>
        </div>
      </div>

      {/* Status row */}
      <div style={{ marginTop: 22 }}>
        <SectionTitle>Status</SectionTitle>
        <div style={{ display: 'flex', gap: 11, overflowX: 'auto', padding: '0 0 4px', scrollbarWidth: 'none' }}>
          <StatTile icon="thermo" label="Avg. indoor" value={avgTemp + '°'} tint="#E07B53" onTap={() => go('climate')} />
          <StatTile icon="pool"    label={poolStatus}          value={poolTemp > 0 ? poolTemp + '°' : 'N/A'} tint="#2bb3a3" onTap={() => go('pool')} />
          {poolPh !== null && <StatTile icon="droplet" label={phStatus ?? 'Pool pH'} value={poolPh.toFixed(1)}             tint={phTint}    onTap={() => go('pool')} />}
          <StatTile icon="bulb"   label="Lights on"   value={lightsOn} tint="#F0A500" onTap={() => go('lights')} />
          <StatTile icon="lock"   label="Doors locked" value={`${doorsLocked}/${config.doorsExterior.length}`} tint="#34A853" onTap={() => go('doors')} />
          <StatTile icon="motion" label="Motion alerts" value={motionAlerts} tint="#E0483D" onTap={() => go('motion')} />
          <StatTile icon="person" label="Home"        value={peopleHome} tint="#5B7FE0" onTap={() => go('whoshome')} />
        </div>
      </div>

      {/* Scenes */}
      <div style={{ marginTop: 22 }}>
        <SectionTitle action="Edit" onAction={() => go('editscenes')}>Environments</SectionTitle>
        {sceneIds.length === 0 ? (
          <Card>
            <button onClick={() => go('editscenes')} style={{
              width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '14px 0', color: 'var(--text2)',
            }}>
              <Icon name="plus" size={26} />
              <span style={{ fontSize: 14, fontWeight: 560 }}>Add scenes</span>
            </button>
          </Card>
        ) : (
          <div style={{ display: 'flex', gap: 11, overflowX: 'auto', scrollbarWidth: 'none',
            margin: '0 calc(-1 * var(--screen-px))', padding: '0 var(--screen-px) 4px' }}>
            {sceneIds.map(id => {
              const sc = sceneById[id];
              if (sc) {
                const on = activeScene === sc.id;
                return (
                  <button key={sc.id} data-control={deviceTag(sc.name, sc.id, config.controlStateIds)} onClick={() => setActiveScene(on ? null : sc.id)} style={{
                    flex: '0 0 auto', border: 'none', cursor: 'pointer', borderRadius: 18,
                    padding: '14px 16px 12px', background: on ? sc.tint : 'var(--card)',
                    boxShadow: on ? 'none' : 'var(--shadow)',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, width: 104,
                    WebkitTapHighlightColor: 'transparent', transition: 'background .2s',
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: on ? 'rgba(255,255,255,0.25)' : sc.tint + '1f', color: on ? '#fff' : sc.tint,
                    }}>
                      <Icon name={sc.icon as React.ComponentProps<typeof Icon>['name']} size={21} />
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: on ? '#fff' : 'var(--text)', textAlign: 'left', letterSpacing: -0.2 }}>{sc.name}</span>
                  </button>
                );
              }
              const ctrl = envById[id];
              if (ctrl) {
                const n = ctrl.name.toLowerCase();
                const { icon, tint } = ((): { icon: IconName; tint: string } => {
                  if (n.includes('temp'))     return { icon: 'thermo',   tint: '#E07B53' };
                  if (n.includes('humid'))    return { icon: 'droplet',  tint: '#5B7FE0' };
                  if (n.includes('holiday'))  return { icon: 'calendar', tint: '#9B6AB0' };
                  if (n.includes('security')) return { icon: 'shield',   tint: '#E0483D' };
                  if (n.includes('away'))     return { icon: 'away',     tint: '#F0A500' };
                  return { icon: 'bolt', tint: '#2bb3a3' };
                })();
                const s = st[ctrl.id] as FlagState | undefined;
                const on = s?.on ?? false;
                return (
                  <StatTile key={ctrl.id} icon={icon} label={ctrl.name} value="" tint={tint}
                    compact active={on}
                    data-control={deviceTag(ctrl.name, ctrl.id, config.controlStateIds)}
                    onTap={() => setD(ctrl.id, { on: !on })} />
                );
              }
              return null;
            })}
          </div>
        )}
      </div>

      {/* Favorites */}
      <div style={{ marginTop: 22 }}>
        <SectionTitle action="Edit" onAction={() => go('editfav')}>Favorites</SectionTitle>
        {favIds.length === 0 ? (
          <Card>
            <button onClick={() => go('editfav')} style={{
              width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '14px 0', color: 'var(--text2)',
            }}>
              <Icon name="plus" size={26} />
              <span style={{ fontSize: 14, fontWeight: 560 }}>Add favorites</span>
            </button>
          </Card>
        ) : (
          <div className="hca-tile-grid">
            {favIds.map(id => {
              const it = favLookup[id];
              if (!it) return null;
              if (lightSceneIds.has(id)) {
                return <SceneFavTile key={id} id={id} label={it.label} />;
              }
              if (carDoorIds.has(id)) {
                return <CarDoorTile key={id} door={{ id, name: it.label }} compact />;
              }
              if (it.icon === 'bulb' && !lightSceneIds.has(id)) {
                return <LightFavTile key={id} id={id} label={it.label} />;
              }
              if (it.icon === 'speaker') {
                return <SpeakerFavTile key={id} id={id} label={it.label} />;
              }
              if (it.icon === 'fan') {
                return <FanFavTile key={id} id={id} label={it.label} />;
              }
              return <FavTile key={id} id={it.id} icon={it.icon as React.ComponentProps<typeof Icon>['name']} label={it.label} />;
            })}
          </div>
        )}
      </div>

      {/* Mini Climate */}
      {(config.climate.length > 0 || config.houseClimateId) && (
        <div style={{ marginTop: 22 }}>
          <SectionTitle action="Details" onAction={() => go('climate')}>Climate</SectionTitle>
          {config.houseClimateId && (
            <div style={{ marginBottom: 12 }}>
              <Segmented options={['Home', 'Away', 'Sleep']} value={climateMode} onChange={setClimateMode} />
            </div>
          )}
          {config.climate.length > 0 && (
            <div className="hca-tile-grid">
              {config.climate.map(zone => <MiniClimateZoneTile key={zone.id} zone={zone} />)}
            </div>
          )}
        </div>
      )}

      {/* People */}
      <div style={{ marginTop: 22 }}>
        <SectionTitle>Who&apos;s Home</SectionTitle>
        <Card pad={false} style={{ padding: '16px 12px' }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {config.people.map(p => {
              const home = (st[p.id] as FlagState | undefined)?.on ?? false;
              return (
                <PersonAvatar key={p.id} id={p.id} name={p.name} present={home}
                  onToggle={() => setD(p.id, { on: !home })} />
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
