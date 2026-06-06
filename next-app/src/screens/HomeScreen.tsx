'use client';

import React, { useState } from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Tile } from '@/components/Tile';
import { Toggle } from '@/components/Toggle';
import { Card, SectionTitle } from '@/components/Card';
import { Segmented } from '@/components/Segmented';
import { Avatar } from '@/components/Avatar';
import { LargeTitle } from '@/components/LargeTitle';
import { iconBtn, pillBtn } from '@/lib/styles';
import { Slider } from '@/components/Slider';
import type { LightState, LockState, SpeakerState, FanState, GlobalState, FavsState, ScenesListState, PersonState, PoolState, AutomationState } from '@/types/state';

// ── Scrollable stat pill ──────────────────────────────────────────────────────
function StatTile({ icon, label, value, tint, onTap }: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string | number;
  tint: string;
  onTap?: () => void;
}) {
  return (
    <div onClick={onTap} style={{
      background: 'var(--card)', borderRadius: 20, boxShadow: 'var(--shadow)',
      padding: '13px 15px', minWidth: 128, flex: '0 0 auto',
      cursor: onTap ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: tint + '22', color: tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 9 }}>
        <Icon name={icon} size={18} strokeWidth={2} />
      </div>
      <div style={{ fontSize: 21, fontWeight: 720, color: 'var(--text)', letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500, marginTop: 1 }}>{label}</div>
    </div>
  );
}

// ── Fav tiles (defined outside HomeScreen to preserve component identity across renders) ──

function FavTile({ id, icon, label }: { id: string; icon: React.ComponentProps<typeof Icon>['name']; label: string }) {
  const { st, setD } = useHC();
  const s = st[id] ?? { on: false, level: 0 };
  const isLight = 'level' in s || icon === 'bulb';
  const isDoor = 'locked' in s;
  const on = isDoor ? (s as LockState).locked : (s as { on?: boolean }).on ?? false;
  const toggle = () => {
    if (isDoor) setD(id, { locked: !(s as LockState).locked });
    else if (isLight) { const ls = s as LightState; setD(id, { on: !ls.on, level: !ls.on ? (ls.level || 100) : (ls.level ?? 100) }); }
    else setD(id, { on: !(s as { on: boolean }).on });
  };
  const status = isDoor
    ? ((s as LockState).locked ? 'Locked' : 'Unlocked')
    : isLight ? ((s as LightState).on ? `On · ${(s as LightState).level}%` : 'Off')
    : ((s as { on: boolean }).on ? 'On' : 'Off');
  const color = isDoor
    ? ((s as LockState).locked ? 'var(--green)' : 'var(--red)')
    : isLight ? 'var(--amber)' : 'var(--accent)';
  const icn: React.ComponentProps<typeof Icon>['name'] =
    isDoor ? ((s as LockState).locked ? 'lock' : 'unlock') : icon;
  return (
    <Tile icon={icn} name={label} status={status} active={on} activeColor={color}
      glow={isLight} onTap={toggle}
      control={<Toggle on={on} onChange={toggle} accent="rgba(255,255,255,0.4)" size={0.78} />} />
  );
}

function LightFavTile({ id, label }: { id: string; label: string }) {
  const { st, setD, config } = useHC();
  const s = (st[id] as LightState | undefined) ?? { on: false, level: 0 };
  const snap = config.lightRooms.flatMap(r => r.lights).find(l => l.id === id)?.kind === 'switch';
  const set = (level: number) => {
    const v = snap ? (level >= 50 ? 100 : 0) : level;
    setD(id, { level: v, on: v > 0 });
  };
  const toggle = () => setD(id, { on: !s.on, level: !s.on ? 100 : 0 });
  return (
    <div style={{ gridColumn: 'span 2', position: 'relative', height: 54, borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--slider-track)', touchAction: 'none', userSelect: 'none' }}>
      <Slider value={s.on ? s.level : 0} onChange={set} height={54} track="transparent" fill="linear-gradient(90deg,#f5b942,#ffd86b)" />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span onClick={toggle} style={{ pointerEvents: 'auto', cursor: 'pointer', color: s.on ? '#8a5a00' : 'var(--text3)', display: 'flex' }}>
            <Icon name="bulb" size={21} strokeWidth={1.9} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: s.on ? '#5c3d00' : 'var(--text)', letterSpacing: -0.2 }}>{label}</span>
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: s.on ? '#7a5200' : 'var(--text3)' }}>
          {s.on ? (snap ? '100%' : `${s.level}%`) : 'Off'}
        </span>
      </div>
    </div>
  );
}

function FanFavTile({ id, label }: { id: string; label: string }) {
  const { st, setD } = useHC();
  const s = (st[id] as FanState | undefined) ?? { on: false, speed: 0 as FanState['speed'] };
  const SPEEDS = ['Off', 'Low', 'Med', 'High'] as const;
  const setSpeed = (sp: number) => setD(id, { speed: sp as FanState['speed'], on: sp > 0 });
  const spinDuration = s.on ? `${1.4 - s.speed * 0.3}s` : undefined;
  return (
    <div style={{ gridColumn: 'span 2' }}>
      <Card style={{ padding: '12px 14px 13px' }}>
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
  const { st, setD } = useHC();
  const s = (st[id] as SpeakerState | undefined) ?? { on: false, vol: 0 };
  const set = (vol: number) => setD(id, { vol, on: vol > 0 });
  const toggle = () => setD(id, { on: !s.on, vol: !s.on ? (s.vol || 30) : s.vol });
  return (
    <div style={{ gridColumn: 'span 2', position: 'relative', height: 54, borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--slider-track)', touchAction: 'none', userSelect: 'none' }}>
      <Slider value={s.on ? s.vol : 0} onChange={set} height={54} track="transparent" fill="linear-gradient(90deg,#6a4a7a,#9b6ab0)" />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span onClick={toggle} style={{ pointerEvents: 'auto', cursor: 'pointer', color: s.on ? '#fff' : 'var(--text3)', display: 'flex' }}>
            <Icon name="speaker" size={21} strokeWidth={1.9} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: s.on ? '#fff' : 'var(--text)', letterSpacing: -0.2 }}>{label}</span>
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: s.on ? 'rgba(255,255,255,0.85)' : 'var(--text3)' }}>
          {s.on ? `${s.vol}%` : 'Off'}
        </span>
      </div>
    </div>
  );
}

function SceneFavTile({ id, label }: { id: string; label: string }) {
  const { st, setD, config } = useHC();
    const room = config.sceneRooms.find(r => r.id === id);
    const a = st[`auto:${id}`] as AutomationState | undefined;
    if (!room || !a) return null;
    const set = (patch: Partial<AutomationState>) => setD(`auto:${id}`, patch);
    return (
      <div style={{ gridColumn: 'span 2' }}>
        <Card pad={false} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 10px' }}>
            <span style={{ width: 9, height: 9, borderRadius: 5, flex: '0 0 auto',
              background: !a.automated ? 'var(--text3)' : a.motion ? 'var(--green)' : 'var(--text3)' }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 640, letterSpacing: -0.3,
              color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label}
            </div>
            {room.autoId !== undefined && (
              <button onClick={() => set({ automated: !a.automated })} style={{
                display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto',
                border: 'none', cursor: 'pointer', borderRadius: 999, padding: '7px 13px 7px 11px',
                fontSize: 13.5, fontWeight: 640, letterSpacing: -0.2,
                background: a.automated ? 'var(--accent)' : 'var(--icon-bg)',
                color: a.automated ? '#fff' : 'var(--text2)',
                WebkitTapHighlightColor: 'transparent', transition: 'all .18s',
              }}>
                <Icon name="power" size={15} strokeWidth={2.3} />{a.automated ? 'Auto' : 'Off'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 13px' }}>
            <div style={{ flex: 1, opacity: a.automated ? 1 : 0.5 }}>
              <Slider value={a.intensity} onChange={(v) => set({ intensity: v })} min={0} max={100}
                icon={<Icon name="bulb" size={18} />} fill="var(--accent)" height={34} />
            </div>
            <div style={{ display: 'flex', gap: 7, flex: '0 0 auto' }}>
              {room.motionId !== undefined && (
                <button onClick={() => set({ motion: !a.motion })} title={`Motion: ${a.motion ? 'Detected' : 'Clear'}`}
                  style={{ width: 38, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: a.motion ? '#DD8A0A' : 'var(--icon-bg)', color: a.motion ? '#fff' : 'var(--text3)',
                    opacity: !a.automated || (!!room.doorId && !a.doorOpen) ? 0.45 : 1,
                    WebkitTapHighlightColor: 'transparent' }}>
                  <Icon name="motion" size={19} />
                </button>
              )}
              {room.doorId !== undefined && (
                <button onClick={() => set({ doorOpen: !a.doorOpen })} title={`Door: ${a.doorOpen ? 'Open' : 'Closed'}`}
                  style={{ width: 38, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: !a.doorOpen ? '#5B7FE0' : 'var(--icon-bg)', color: !a.doorOpen ? '#fff' : 'var(--text3)',
                    WebkitTapHighlightColor: 'transparent' }}>
                  <Icon name="door" size={19} />
                </button>
              )}
              {room.switchId !== undefined && (
                <button onClick={() => set({ manual: !a.manual })} title={`Switch: ${a.manual ? 'Manual' : 'Auto'}`}
                  style={{ width: 38, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: a.manual ? 'var(--amber)' : 'var(--icon-bg)', color: a.manual ? '#fff' : 'var(--text3)',
                    WebkitTapHighlightColor: 'transparent' }}>
                  <Icon name="power" size={19} />
                </button>
              )}
              {room.nightDimId !== undefined && (
                <button onClick={() => set({ nightDim: !a.nightDim })} title={`Night LEDs: ${a.nightDim ? 'Dimmed' : 'Normal'}`}
                  style={{ width: 38, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: a.nightDim ? '#7A5AE0' : 'var(--icon-bg)', color: a.nightDim ? '#fff' : 'var(--text3)',
                    WebkitTapHighlightColor: 'transparent' }}>
                  <Icon name="moon" size={19} />
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

export function HomeScreen() {
  const { st, setD, go, config } = useHC();
  const global = st['_global'] as GlobalState;
  const tod = global.timeOfDay;
  const setTod = (v: string) => setD('_global', { timeOfDay: v as GlobalState['timeOfDay'] });
  const [activeScene, setActiveScene] = useState<string | null>(null);

  const lightsOn = config.lightRooms.reduce((n, r) =>
    n + r.lights.filter(l => (st[l.id] as LightState | undefined)?.on).length, 0);
  const doorsLocked = config.doorsExterior.filter(d => (st[d.id] as LockState | undefined)?.locked).length;
  const peopleHome = config.people.filter(p => (st[`person:${p.id}`] as PersonState | undefined)?.home).length;
  const motionAlerts = config.motionSensors.filter(s => {
    const rec = st[s.id] as { motion?: boolean } | undefined;
    return rec?.motion;
  }).length;
  const avgTemp = config.climate.length
    ? (config.climate.reduce((sum, c) => sum + ((st[c.id] as { temp?: number } | undefined)?.temp ?? 72), 0) / config.climate.length).toFixed(1)
    : '–';
  const poolTemp = (st['pool'] as PoolState | undefined)?.poolTemp ?? 81;

  const cond = global.weather;
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
  const wLabel = cond;
  const cycleWeather = () => {
    const seq: GlobalState['weather'][] = ['Clear', 'Cloudy', 'Rain', 'Snow'];
    setD('_global', { weather: seq[(seq.indexOf(cond) + 1) % seq.length] });
  };

  const sceneIds = (st['_scenes'] as ScenesListState).ids;
  const favIds   = (st['_favs']   as FavsState).ids;
  const sceneById = Object.fromEntries(config.scenes.map(s => [s.id, s]));
  const favLookup = Object.fromEntries(config.favCatalog.flatMap(g => g.items.map(it => [it.id, it])));
  const lightSceneIds = new Set(config.lightSceneRooms.map(r => r.id));

  const greetings: Record<string, string> = { Morning: 'Good morning', Day: 'Good afternoon', Evening: 'Good evening', Night: 'Good night' };

  return (
    <div>
      <LargeTitle title={greetings[tod] ?? 'Home'} sub="The House"
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
                <div style={{ fontSize: 46, fontWeight: 300, letterSpacing: -2, lineHeight: 1, marginTop: 6 }}>70°</div>
                <div style={{ fontSize: 13.5, fontWeight: 500, opacity: 0.85, marginTop: 4 }}>{wLabel} · H:77° L:58°</div>
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
          <StatTile icon="pool"   label="Pool temp"   value={poolTemp + '°'} tint="#2bb3a3" onTap={() => go('pool')} />
          <StatTile icon="bulb"   label="Lights on"   value={lightsOn} tint="#F0A500" onTap={() => go('lights')} />
          <StatTile icon="lock"   label="Doors locked" value={`${doorsLocked}/${config.doorsExterior.length}`} tint="#34A853" onTap={() => go('doors')} />
          <StatTile icon="motion" label="Motion alerts" value={motionAlerts} tint="#E0483D" onTap={() => go('motion')} />
          <StatTile icon="person" label="Home"        value={peopleHome} tint="#5B7FE0" />
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
          <div style={{ display: 'flex', gap: 11, overflowX: 'auto', padding: '0 0 4px', scrollbarWidth: 'none' }}>
            {sceneIds.map(id => {
              const sc = sceneById[id];
              if (!sc) return null;
              const on = activeScene === sc.id;
              return (
                <button key={sc.id} onClick={() => setActiveScene(on ? null : sc.id)} style={{
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

      {/* People */}
      <div style={{ marginTop: 22 }}>
        <SectionTitle>Who&apos;s Home</SectionTitle>
        <Card pad={false} style={{ padding: '16px 12px' }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {config.people.map(p => {
              const home = (st[`person:${p.id}`] as PersonState | undefined)?.home ?? false;
              const toggle = () => setD(`person:${p.id}`, { home: !home });
              return (
                <button key={p.id} onClick={toggle}
                  style={{ flex: '0 0 auto', width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                    border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 0',
                    WebkitTapHighlightColor: 'transparent' }}>
                  <Avatar name={p.name} present={home} />
                  <span style={{ fontSize: 12.5, fontWeight: 560, color: home ? 'var(--text)' : 'var(--text3)' }}>{p.name}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
