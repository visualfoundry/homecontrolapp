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
import type { LightState, LockState, SpeakerState, FanState, GlobalState, FavsState, ScenesListState, PersonState, PoolState } from '@/types/state';

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

  // Fav tile factory
  function FavTile({ id, icon, label }: { id: string; icon: React.ComponentProps<typeof Icon>['name']; label: string }) {
    const s = st[id];
    if (!s) return null;
    const isLight = 'level' in s;
    const isDoor = 'locked' in s;
    const on = isDoor ? (s as LockState).locked : (s as { on?: boolean }).on ?? false;
    const toggle = () => {
      if (isDoor) setD(id, { locked: !(s as LockState).locked });
      else if (isLight) { const ls = s as LightState; setD(id, { on: !ls.on, level: !ls.on ? (ls.level || 100) : ls.level }); }
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

  const sceneIds = (st['_scenes'] as ScenesListState).ids;
  const favIds   = (st['_favs']   as FavsState).ids;
  const sceneById = Object.fromEntries(config.scenes.map(s => [s.id, s]));
  const favLookup = Object.fromEntries(config.favCatalog.flatMap(g => g.items.map(it => [it.id, it])));

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
        <SectionTitle action="Edit" onAction={() => go('editscenes')}>Scenes</SectionTitle>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {favIds.map(id => {
              const it = favLookup[id];
              if (!it || !st[id]) return null;
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
