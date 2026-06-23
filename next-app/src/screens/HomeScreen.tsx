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

// Map tomorrow.io weatherCode integer to a visual bucket + human label.
const TOMORROW_LABELS: Record<number, string> = {
  1000: 'Clear', 1100: 'Mostly Clear', 1101: 'Partly Cloudy', 1102: 'Mostly Cloudy',
  1001: 'Cloudy', 2000: 'Foggy', 2100: 'Light Fog',
  4000: 'Drizzle', 4001: 'Rain', 4200: 'Light Rain', 4201: 'Heavy Rain',
  5000: 'Snow', 5001: 'Flurries', 5100: 'Light Snow', 5101: 'Heavy Snow',
  6000: 'Freezing Drizzle', 6001: 'Freezing Rain',
  6200: 'Light Freezing Rain', 6201: 'Heavy Freezing Rain',
  7000: 'Ice Pellets', 7101: 'Heavy Ice Pellets', 7102: 'Light Ice Pellets',
  8000: 'Thunderstorm',
};
function mapTomorrowIoCode(code: number): WeatherCondition {
  if (code >= 4000 && code <= 4201) return 'Rain';
  if (code === 8000) return 'Rain';
  if (code >= 5000 && code <= 7102) return 'Snow';
  if (code === 1001 || code === 1102 || code >= 2000) return 'Cloudy';
  return 'Clear';
}

// Animated weather icon — replaces the old cycleWeather button.
function WeatherWidget({ cond, skyDark }: { cond: WeatherCondition; skyDark: boolean }) {
  const c = 'rgba(255,255,255,0.92)';
  const box: React.CSSProperties = {
    background: 'rgba(255,255,255,0.18)', width: 56, height: 56, borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative', flexShrink: 0,
  };

  if (cond === 'Clear' && !skyDark) {
    return (
      <div style={box}>
        {/* pulsing halo */}
        <div style={{ position: 'absolute', width: 38, height: 38, borderRadius: '50%', background: c, animation: 'sunHalo 3s ease-in-out infinite' }} />
        {/* rays ring — slow spin */}
        <div style={{ position: 'absolute', width: 52, height: 52, animation: 'spin 16s linear infinite' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute', left: '50%', top: 0,
              width: 2, height: 8, marginLeft: -1,
              background: c, borderRadius: 1, opacity: 0.85,
              transform: `rotate(${i * 45}deg)`,
              transformOrigin: '1px 26px',
            }} />
          ))}
        </div>
        {/* sun disk */}
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: c, position: 'relative', zIndex: 1 }} />
      </div>
    );
  }

  if (cond === 'Clear' && skyDark) {
    return (
      <div style={box}>
        {/* stars */}
        {[{ x: 38, y: 10, s: 3, d: '0s' }, { x: 14, y: 16, s: 2, d: '0.8s' }, { x: 42, y: 36, s: 2.5, d: '1.5s' }].map((star, i) => (
          <div key={i} style={{
            position: 'absolute', left: star.x, top: star.y,
            width: star.s, height: star.s, borderRadius: '50%',
            background: c, animation: `twinkle 2s ease-in-out ${star.d} infinite`,
          }} />
        ))}
        {/* moon crescent */}
        <Icon name="moon" size={28} strokeWidth={1.6} style={{ color: c, position: 'relative', zIndex: 1 }} />
      </div>
    );
  }

  if (cond === 'Cloudy') {
    return (
      <div style={box}>
        <div style={{ animation: 'cloudDrift 4s ease-in-out infinite' }}>
          <Icon name="cloud" size={30} strokeWidth={1.6} style={{ color: c }} />
        </div>
      </div>
    );
  }

  if (cond === 'Rain') {
    return (
      <div style={box}>
        <div style={{ position: 'absolute', top: 4, left: 15, animation: 'cloudDrift 4s ease-in-out infinite' }}>
          <Icon name="cloud" size={26} strokeWidth={1.6} style={{ color: c }} />
        </div>
        {[0.42, 0.54, 0.48, 0.60, 0.50].map((dur, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${8 + i * 10}px`, top: 22,
            width: 1.5, height: 10, background: c, borderRadius: 2, opacity: 0.85,
            animation: `rainWidget ${dur}s linear ${(i * 0.09).toFixed(2)}s infinite`,
          }} />
        ))}
      </div>
    );
  }

  // Snow
  return (
    <div style={box}>
      <div style={{ position: 'absolute', top: 4, left: 15, animation: 'cloudDrift 4s ease-in-out infinite' }}>
        <Icon name="cloud" size={26} strokeWidth={1.6} style={{ color: c }} />
      </div>
      {[2.0, 2.4, 1.8, 2.6, 2.2].map((dur, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${8 + i * 10}px`, top: 22,
          width: 5, height: 5, borderRadius: '50%', background: c,
          animation: `snowWidget ${dur}s linear ${(i * 0.22).toFixed(2)}s infinite`,
        }} />
      ))}
    </div>
  );
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
    <div className="hca-fav-wide" data-control={deviceTag(label, id, config.controlStateIds)} style={{ position: 'relative', height: 96, borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--slider-track)', touchAction: 'none', userSelect: 'none' }}>
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
    <div className="hca-fav-wide" data-control={deviceTag(label, id, config.controlStateIds)}>
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
    <div className="hca-fav-wide" data-control={deviceTag(label, id, config.controlStateIds)}>
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
    <div className="hca-fav-wide" data-control={deviceTag(room.name, id, config.controlStateIds)}>
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

// ---------------------------------------------------------------------------
// Env tile — illustrated background scenes (one per environment type)
// ---------------------------------------------------------------------------

function MovieNightScene() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      {/* Cinema screen */}
      <rect x="4" y="4" width="72" height="42" rx="6" fill="currentColor" />
      {/* Screen inner (dimmer) */}
      <rect x="9" y="9" width="62" height="32" rx="4" fill="currentColor" opacity="0.4" />
      {/* Projector light cone */}
      <path d="M40 50 L10 46 L70 46Z" fill="currentColor" opacity="0.45" />
      {/* Projector box */}
      <rect x="33" y="50" width="14" height="10" rx="3" fill="currentColor" />
      {/* Seat row */}
      <path d="M4 70 Q4 62 12 62 Q20 62 20 70" fill="currentColor" opacity="0.75" />
      <path d="M24 70 Q24 62 32 62 Q40 62 40 70" fill="currentColor" opacity="0.75" />
      <path d="M44 70 Q44 62 52 62 Q60 62 60 70" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

function PoolPartyScene() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      {/* Sun */}
      <circle cx="64" cy="16" r="11" fill="currentColor" />
      {/* Sun rays */}
      <path d="M64 1V6M64 26V31M79 16H74M49 16H54M74.5 5.5L71 9M53.5 5.5L57 9M74.5 26.5L71 23M53.5 26.5L57 23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      {/* Pool float ring */}
      <ellipse cx="32" cy="50" rx="22" ry="10" stroke="currentColor" strokeWidth="4" opacity="0.9" />
      <ellipse cx="32" cy="50" rx="13" ry="5.5" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      {/* Water waves */}
      <path d="M2 64 Q12 59 22 64 Q32 69 42 64 Q52 59 78 64" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <path d="M2 73 Q12 68 22 73 Q32 78 42 73 Q52 68 78 73" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function HolidayScene() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      {/* Tree (three tiers) */}
      <path d="M40 10 L22 34 L30 34 L16 54 L26 54 L14 74 L66 74 L54 54 L64 54 L50 34 L58 34 Z" fill="currentColor" opacity="0.9" />
      {/* Trunk */}
      <rect x="35" y="72" width="10" height="8" fill="currentColor" />
      {/* Star at top */}
      <path d="M40 2 L42 8 L48 8.5 L43 12 L45 18 L40 14.5 L35 18 L37 12 L32 8.5 L38 8 Z" fill="currentColor" />
      {/* Ornaments */}
      <circle cx="30" cy="48" r="4" fill="currentColor" opacity="0.65" />
      <circle cx="50" cy="44" r="4" fill="currentColor" opacity="0.6" />
      <circle cx="40" cy="60" r="4" fill="currentColor" opacity="0.7" />
      <circle cx="24" cy="62" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="56" cy="60" r="3" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function SecurityScene() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      {/* House body */}
      <path d="M10 74 L10 40 L40 18 L70 40 L70 74 Z" fill="currentColor" opacity="0.5" />
      {/* Roof ridge */}
      <path d="M4 42 L40 14 L76 42" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" opacity="0.85" />
      {/* Door */}
      <rect x="32" y="56" width="16" height="18" rx="2" fill="currentColor" opacity="0.8" />
      {/* Windows */}
      <rect x="14" y="46" width="12" height="10" rx="2" fill="currentColor" opacity="0.7" />
      <rect x="54" y="46" width="12" height="10" rx="2" fill="currentColor" opacity="0.7" />
      {/* Shield */}
      <path d="M40 26 L28 32 L28 44 C28 53 33.5 58 40 61 C46.5 58 52 53 52 44 L52 32 Z" fill="currentColor" />
      {/* Checkmark in shield */}
      <path d="M33 43 L38 49 L48 37" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
    </svg>
  );
}

function AwayScene() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      {/* Stars */}
      <circle cx="10" cy="10" r="2.5" fill="currentColor" />
      <circle cx="30" cy="6" r="1.5" fill="currentColor" opacity="0.75" />
      <circle cx="52" cy="12" r="2" fill="currentColor" opacity="0.85" />
      <circle cx="68" cy="6" r="3" fill="currentColor" />
      <circle cx="22" cy="22" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="72" cy="20" r="1.5" fill="currentColor" opacity="0.65" />
      {/* Suitcase body */}
      <rect x="18" y="44" width="44" height="30" rx="5" fill="currentColor" opacity="0.85" />
      {/* Centre seam */}
      <path d="M18 59 L62 59" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <rect x="36" y="44" width="8" height="30" fill="currentColor" opacity="0.15" />
      {/* Handle */}
      <path d="M28 44 Q28 36 40 36 Q52 36 52 44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9" />
      {/* Wheels */}
      <circle cx="26" cy="74" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="54" cy="74" r="3" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function TempScene() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      {/* Sun */}
      <circle cx="40" cy="28" r="18" fill="currentColor" />
      {/* Rays */}
      <path d="M40 4V9M40 47V52M16 28H11M64 28H69M22 12L18 8M58 12L62 8M22 44L18 48M58 44L62 48" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      {/* Heat waves */}
      <path d="M10 62 Q20 57 30 62 Q40 67 50 62 Q60 57 70 62" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
      <path d="M6 72 Q18 67 28 72 Q40 77 50 72 Q62 67 74 72" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function HumidScene() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      {/* Cloud (overlapping circles + ellipse base) */}
      <circle cx="28" cy="28" r="14" fill="currentColor" opacity="0.85" />
      <circle cx="48" cy="24" r="16" fill="currentColor" opacity="0.85" />
      <ellipse cx="36" cy="34" rx="24" ry="14" fill="currentColor" opacity="0.85" />
      {/* Rain lines */}
      <path d="M16 52 L10 66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M30 54 L24 70" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
      <path d="M44 52 L38 68" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M58 54 L52 70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      {/* Teardrop tips */}
      <path d="M10 66 Q10 72 12.5 72 Q15 72 15 66" fill="currentColor" opacity="0.75" />
      <path d="M24 70 Q24 76 26.5 76 Q29 76 29 70" fill="currentColor" opacity="0.7" />
      <path d="M38 68 Q38 74 40.5 74 Q43 74 43 68" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

function DefaultScene() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      {/* Concentric rings */}
      <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <circle cx="40" cy="40" r="25" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      <circle cx="40" cy="40" r="14" fill="currentColor" opacity="0.65" />
      {/* Lightning bolt */}
      <path d="M45 18 L31 44 L41 44 L35 62 L55 36 L43 36 Z" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function EnvScene({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes('movie'))      return <MovieNightScene />;
  if (n.includes('pool party')) return <PoolPartyScene />;
  if (n.includes('holiday'))    return <HolidayScene />;
  if (n.includes('security'))   return <SecurityScene />;
  if (n.includes('away'))       return <AwayScene />;
  if (n.includes('temp'))       return <TempScene />;
  if (n.includes('humid'))      return <HumidScene />;
  return <DefaultScene />;
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
    const rec = st[s.id] as { motion?: boolean; on?: boolean } | undefined;
    return rec?.motion ?? rec?.on ?? false;
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

  // Weather conditions: tomorrow.io sends a numeric code via EISY variable.
  // Try numeric value first; fall back to text mapping, then ambient mock state.
  const condCode = config.weatherCondId
    ? (st[config.weatherCondId] as VariableState | undefined)?.value
    : undefined;
  const condRaw = config.weatherCondId
    ? (st[config.weatherCondId] as TextVariableState | undefined)?.text
    : undefined;
  const cond = condCode !== undefined
    ? mapTomorrowIoCode(condCode)
    : condRaw ? mapCondition(condRaw) : global.weather;
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
  const wLabel = condCode !== undefined
    ? (TOMORROW_LABELS[condCode] ?? cond)
    : (condRaw ?? cond);
  const hiLo = `L:${weatherLow != null ? Math.round(weatherLow) : '–'}° H:${weatherHigh != null ? Math.round(weatherHigh) : '–'}°`;

  const sceneIds = (st['_scenes'] as ScenesListState).ids;
  const favIds   = (st['_favs']   as FavsState).ids;

  // Auto-seed: any env control not yet in sceneIds gets appended once.
  // sceneIds is a dependency so this re-runs if /api/prefs overwrites _scenes with a stale list.
  React.useEffect(() => {
    const missing = config.environmentalControls.filter(e => !sceneIds.includes(e.id));
    if (missing.length > 0) setD('_scenes', { ids: [...sceneIds, ...missing.map(e => e.id)] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.environmentalControls.map(e => e.id).join(','), sceneIds.join(',')]);
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
              <WeatherWidget cond={cond} skyDark={skyDark} />
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
                  if (n.includes('movie'))    return { icon: 'film',       tint: '#6C5CE7' };
                  if (n.includes('pool party')) return { icon: 'poolParty',  tint: '#00AAFF' };
                  return { icon: 'bolt', tint: '#2bb3a3' };
                })();
                const s = st[ctrl.id] as FlagState | undefined;
                const on = s?.on ?? false;
                return (
                  <div
                    key={ctrl.id}
                    role="button"
                    tabIndex={0}
                    data-control={deviceTag(ctrl.name, ctrl.id, config.controlStateIds)}
                    onClick={() => setD(ctrl.id, { on: !on })}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setD(ctrl.id, { on: !on }); } }}
                    style={{
                      position: 'relative', flex: '0 0 auto', width: 108,
                      borderRadius: 18, overflow: 'hidden', cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      padding: '14px 14px 13px', minHeight: 124,
                      background: on ? tint : `linear-gradient(160deg,${tint}20 0%,${tint}0a 100%)`,
                      boxShadow: on ? `0 0 22px ${tint}55, var(--shadow)` : 'var(--shadow)',
                      border: on ? 'none' : `1.5px solid ${tint}30`,
                      outline: 'none',
                      transition: 'background 0.2s, box-shadow 0.2s, border-color 0.2s',
                    }}
                  >
                    {/* Watermark — illustrated scene fills the background */}
                    <div style={{
                      position: 'absolute', right: -10, bottom: -6, zIndex: 0,
                      opacity: on ? 0.14 : 0.20,
                      color: on ? '#ffffff' : tint,
                      pointerEvents: 'none',
                    }}>
                      <EnvScene name={ctrl.name} />
                    </div>

                    {/* Icon chip */}
                    <div style={{
                      position: 'relative', zIndex: 1,
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: on ? 'rgba(255,255,255,0.22)' : `${tint}28`,
                      color: on ? '#fff' : tint,
                    }}>
                      <Icon name={icon} size={22} strokeWidth={1.9} />
                    </div>

                    {/* Name + on/off dot */}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{
                        fontSize: 13.5, fontWeight: 640, letterSpacing: -0.2, lineHeight: 1.2,
                        color: on ? '#fff' : 'var(--text)',
                      }}>{ctrl.name}</div>
                      <div style={{
                        marginTop: 5, display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: 11.5, fontWeight: 600,
                        color: on ? 'rgba(255,255,255,0.8)' : tint,
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                          background: on ? 'rgba(255,255,255,0.85)' : `${tint}70`,
                        }} />
                        {on ? 'On' : 'Off'}
                      </div>
                    </div>
                  </div>
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
