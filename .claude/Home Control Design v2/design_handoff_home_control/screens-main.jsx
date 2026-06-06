/* screens-main.jsx — Home, Lights, Doors, Climate + shared screen helpers.
   Exports screen components + helpers to window. */
const { Icon, Toggle, Slider, Card, SectionTitle, Segmented, Avatar, useHC } = window;

// ── Large iOS-style title block ──
function LargeTitle({ title, sub, right }) {
  return (
    <div style={{ padding: '4px 20px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
      <div>
        <div style={{ fontSize: 33, fontWeight: 720, letterSpacing: -0.9, color: 'var(--text)', lineHeight: 1.05 }}>{title}</div>
        {sub && <div style={{ fontSize: 15, color: 'var(--text2)', marginTop: 4, fontWeight: 500 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// ── Generic device tile ──
function Tile({ icon, name, status, active, activeColor = 'var(--accent)', control, onTap, glow }) {
  return (
    <div onClick={onTap} style={{
      background: active ? activeColor : 'var(--card)', borderRadius: 'var(--radius)',
      padding: 15, boxShadow: active ? 'none' : 'var(--shadow)', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 14, minHeight: 116, justifyContent: 'space-between',
      transition: 'background .2s ease', position: 'relative', overflow: 'hidden',
      WebkitTapHighlightColor: 'transparent',
    }}>
      {glow && active && <div style={{ position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', filter: 'blur(18px)' }} />}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'rgba(255,255,255,0.22)' : 'var(--icon-bg)',
          color: active ? '#fff' : 'var(--text2)',
        }}>
          <Icon name={icon} size={22} />
        </div>
        {control}
      </div>
      <div>
        <div style={{ fontSize: 15.5, fontWeight: 640, letterSpacing: -0.3, color: active ? '#fff' : 'var(--text)' }}>{name}</div>
        <div style={{ fontSize: 13, marginTop: 2, fontWeight: 500, color: active ? 'rgba(255,255,255,0.85)' : 'var(--text2)' }}>{status}</div>
      </div>
    </div>
  );
}

// ── Stat pill for the dashboard summary row ──
function StatTile({ icon, label, value, tint, onTap }) {
  return (
    <div onClick={onTap} style={{ background: 'var(--card)', borderRadius: 20, boxShadow: 'var(--shadow)', padding: '13px 15px', minWidth: 128, flex: '0 0 auto', cursor: onTap ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent' }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: tint + '22', color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 9 }}>
        <Icon name={icon} size={18} strokeWidth={2} />
      </div>
      <div style={{ fontSize: 21, fontWeight: 720, color: 'var(--text)', letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500, marginTop: 1 }}>{label}</div>
    </div>
  );
}

// ════════════════════════════ HOME ════════════════════════════
function HomeScreen() {
  const { st, setD, go } = useHC();
  const tod = st['_global'].timeOfDay;
  const setTod = (v) => setD('_global', { timeOfDay: v });
  const [activeScene, setActiveScene] = React.useState(null);

  const lightsOn = HC.lightRooms.reduce((n, r) => n + r.lights.filter(l => st[l.id].on).length, 0);
  const doorsLocked = HC.doorsExterior.filter(d => st[d.id].locked).length;
  const peopleHome = HC.people.filter(p => st['person:' + p.id].home).length;
  const motionAlerts = HC.motionSensors.filter(s => st[s.id].motion).length;
  const avgTemp = (HC.climate.reduce((s, c) => s + st[c.id].temp, 0) / HC.climate.length).toFixed(1);
  const poolTemp = st['pool'].poolTemp;

  const cond = st['_global'].weather;
  const skyDark = tod === 'Night';
  const clearSky = {
    Morning: 'linear-gradient(160deg,#ffd9a8 0%,#ffc1a0 35%,#a8c8e8 100%)',
    Day:     'linear-gradient(160deg,#5fa8e8 0%,#8fc6f0 50%,#cfe8f5 100%)',
    Evening: 'linear-gradient(160deg,#f6a96b 0%,#e07b8a 50%,#7b6aa8 100%)',
    Night:   'linear-gradient(160deg,#1e2a4a 0%,#2d3a5c 55%,#46537a 100%)',
  }[tod];
  const condDay = {
    Cloudy: 'linear-gradient(160deg,#9aa6b2 0%,#c6ced8 100%)',
    Rain:   'linear-gradient(160deg,#5f6b78 0%,#94a0ac 100%)',
    Snow:   'linear-gradient(160deg,#aeb8c4 0%,#e2e9f0 100%)',
  };
  const sky = cond === 'Clear' ? clearSky
    : skyDark ? 'linear-gradient(160deg,#20252c 0%,#39414b 100%)' : condDay[cond];
  const darkText = skyDark || cond === 'Rain';
  const wIcon = cond === 'Clear' ? (skyDark ? 'moon' : 'sun') : cond === 'Cloudy' ? 'cloud' : cond === 'Rain' ? 'rain' : 'snow';
  const wInfo = { Clear: 'Clear', Cloudy: 'Cloudy', Rain: 'Rain', Snow: 'Snow' }[cond];
  const cycleWeather = () => {
    const seq = ['Clear', 'Cloudy', 'Rain', 'Snow'];
    setD('_global', { weather: seq[(seq.indexOf(cond) + 1) % seq.length] });
  };

  const fav = (id, icon, label) => {
    const s = st[id];
    const isLight = 'level' in s;
    const isDoor = 'locked' in s;
    const on = isDoor ? s.locked : s.on;
    const toggle = () => {
      if (isDoor) setD(id, { locked: !s.locked });
      else if (isLight) setD(id, { on: !s.on, level: !s.on ? (s.level || 100) : s.level });
      else setD(id, { on: !s.on });
    };
    const status = isDoor ? (s.locked ? 'Locked' : 'Unlocked')
      : isLight ? (s.on ? `On · ${s.level}%` : 'Off')
      : (s.on ? 'On' : 'Off');
    const color = isDoor ? (s.locked ? 'var(--green)' : 'var(--red)') : (isLight ? 'var(--amber)' : 'var(--accent)');
    const icn = isDoor ? (s.locked ? 'lock' : 'unlock') : icon;
    return <Tile icon={icn} name={label} status={status} active={on} activeColor={color} glow={isLight}
      onTap={toggle} control={<Toggle on={on} onChange={toggle} accent="rgba(255,255,255,0.4)" size={0.78} />} />;
  };

  return (
    <div>
      <LargeTitle title="Good morning" sub="The House · All quiet"
        right={<button onClick={() => go('settings')} style={iconBtn}><Icon name="gear" size={22} /></button>} />

      {/* Weather */}
      <div style={{ padding: '0 18px' }}>
        <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)', background: sky, position: 'relative' }}>
          {(cond === 'Rain' || cond === 'Snow') && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 152, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
              {Array.from({ length: cond === 'Rain' ? 22 : 16 }).map((_, i) => (
                <span key={i} style={cond === 'Rain' ? {
                  position: 'absolute', left: ((i * 4.7) % 100) + '%', top: 0, width: 1.6, height: 15,
                  background: 'rgba(255,255,255,0.6)', borderRadius: 2,
                  animation: `rainfall ${0.55 + (i % 5) * 0.1}s linear ${(i % 8) * 0.11}s infinite`,
                } : {
                  position: 'absolute', left: ((i * 6.3) % 100) + '%', top: 0, width: 6, height: 6, borderRadius: '50%',
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
                <div style={{ fontSize: 46, fontWeight: 300, letterSpacing: -2, lineHeight: 1, marginTop: 6 }}>{cond === 'Snow' ? '34°' : '70°'}</div>
                <div style={{ fontSize: 13.5, fontWeight: 500, opacity: 0.85, marginTop: 4 }}>{wInfo} · H:{cond === 'Snow' ? '38' : '77'}° L:{cond === 'Snow' ? '29' : '58'}°</div>
              </div>
              <button onClick={cycleWeather} title="Tap to change conditions" style={{ background: 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer', width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: darkText ? '#fff' : '#1f3047', WebkitTapHighlightColor: 'transparent' }}>
                <Icon name={wIcon} size={32} strokeWidth={1.7} style={{ opacity: 0.97 }} />
              </button>
            </div>
          </div>
          <div style={{ padding: 10, background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(6px)', position: 'relative', zIndex: 1 }}>
            <Segmented options={['Morning', 'Day', 'Evening', 'Night']} value={tod} onChange={setTod} />
          </div>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginTop: 22 }}>
        <div style={{ padding: '0 18px' }}>
          <SectionTitle>Status</SectionTitle>
        </div>
        <div style={{ display: 'flex', gap: 11, overflowX: 'auto', padding: '0 18px 4px', scrollbarWidth: 'none' }}>
          <StatTile icon="thermo" label="Avg. indoor" value={avgTemp + '°'} tint="#E07B53" onTap={() => go('climate')} />
          <StatTile icon="pool" label="Pool temp" value={poolTemp + '°'} tint="#2bb3a3" onTap={() => go('pool')} />
          <StatTile icon="bulb" label="Lights on" value={lightsOn} tint="#F0A500" onTap={() => go('lights')} />
          <StatTile icon="lock" label="Doors locked" value={`${doorsLocked}/${HC.doorsExterior.length}`} tint="#34A853" onTap={() => go('doors')} />
          <StatTile icon="motion" label="Motion alerts" value={motionAlerts} tint="#E0483D" onTap={() => go('motion')} />
          <StatTile icon="person" label="Home" value={peopleHome} tint="#5B7FE0" />
        </div>
      </div>

      {/* Scenes */}
      <div style={{ marginTop: 22 }}>
        <div style={{ padding: '0 18px' }}>
          <SectionTitle action="Edit" onAction={() => go('editscenes')}>Scenes</SectionTitle>
        </div>
        {(() => {
          const sceneIds = st['_scenes'].ids;
          const byId = {};
          HC.scenes.forEach(s => { byId[s.id] = s; });
          if (sceneIds.length === 0) {
            return (
              <div style={{ padding: '0 18px' }}>
                <Card>
                  <button onClick={() => go('editscenes')} style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 0', color: 'var(--text2)' }}>
                    <Icon name="plus" size={26} />
                    <span style={{ fontSize: 14, fontWeight: 560 }}>Add scenes</span>
                  </button>
                </Card>
              </div>
            );
          }
          return (
            <div style={{ display: 'flex', gap: 11, overflowX: 'auto', padding: '0 18px 4px', scrollbarWidth: 'none' }}>
              {sceneIds.map(id => {
                const sc = byId[id];
                if (!sc) return null;
                const on = activeScene === sc.id;
                return (
                  <button key={sc.id} onClick={() => setActiveScene(on ? null : sc.id)} style={{
                    flex: '0 0 auto', border: 'none', cursor: 'pointer', borderRadius: 18, padding: '14px 16px 12px',
                    background: on ? sc.tint : 'var(--card)', boxShadow: on ? 'none' : 'var(--shadow)',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, width: 104,
                    WebkitTapHighlightColor: 'transparent', transition: 'background .2s',
                  }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: on ? 'rgba(255,255,255,0.25)' : sc.tint + '1f', color: on ? '#fff' : sc.tint }}>
                      <Icon name={sc.icon} size={21} />
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: on ? '#fff' : 'var(--text)', textAlign: 'left', letterSpacing: -0.2 }}>{sc.name}</span>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Favorites */}
      <div style={{ marginTop: 22, padding: '0 18px' }}>
        <SectionTitle action="Edit" onAction={() => go('editfav')}>Favorites</SectionTitle>
        {(() => {
          const favIds = st['_favs'].ids;
          const lookup = {};
          HC.favCatalog.forEach(g => g.items.forEach(it => { lookup[it.id] = it; }));
          if (favIds.length === 0) {
            return (
              <Card>
                <button onClick={() => go('editfav')} style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 0', color: 'var(--text2)' }}>
                  <Icon name="plus" size={26} />
                  <span style={{ fontSize: 14, fontWeight: 560 }}>Add favorites</span>
                </button>
              </Card>
            );
          }
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {favIds.map(id => {
                const it = lookup[id];
                if (!it || !st[id]) return null;
                return <React.Fragment key={id}>{fav(it.id, it.icon, it.label)}</React.Fragment>;
              })}
            </div>
          );
        })()}
      </div>

      {/* People */}
      <div style={{ marginTop: 22, padding: '0 18px' }}>
        <SectionTitle>Who's Home</SectionTitle>
        <Card pad={false} style={{ padding: '16px 12px' }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {HC.people.map(p => {
              const home = st['person:' + p.id].home;
              const toggle = () => setD('person:' + p.id, { home: !home });
              return (
                <button key={p.id} onClick={toggle} title={`${p.name} · ${home ? 'Home' : 'Away'} — tap to toggle`}
                  style={{ flex: '0 0 auto', width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                    border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 0', WebkitTapHighlightColor: 'transparent',
                    transition: 'transform 0.12s ease' }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
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

// ════════════════════════════ LIGHTS ════════════════════════════
// Brightness bar = a tappable/draggable slider per light.
function LightBar({ id, name }) {
  const { st, setD } = useHC();
  const s = st[id];
  const set = (level) => setD(id, { level, on: level > 0 });
  const toggle = (e) => { e.stopPropagation(); setD(id, { on: !s.on, level: !s.on ? (s.level || 100) : s.level }); };
  const shown = s.on ? s.level : 0;
  return (
    <div style={{ position: 'relative', height: 54, borderRadius: 15, overflow: 'hidden', background: 'var(--slider-track)', touchAction: 'none', userSelect: 'none' }}>
      <Slider value={shown} onChange={set} height={54}
        track="transparent" fill="linear-gradient(90deg,#f5b942,#ffd86b)" />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span onClick={toggle} style={{ pointerEvents: 'auto', cursor: 'pointer', color: s.on ? '#8a5a00' : 'var(--text3)', display: 'flex' }}>
            <Icon name="bulb" size={21} strokeWidth={1.9} />
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: s.on ? '#5c3d00' : 'var(--text)', letterSpacing: -0.2 }}>{name}</span>
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: s.on ? '#7a5200' : 'var(--text3)' }}>{s.on ? s.level + '%' : 'Off'}</span>
      </div>
    </div>
  );
}

function LightsScreen() {
  const { st, setD } = useHC();
  const [onlyOn, setOnlyOn] = React.useState(false);
  const totalOn = HC.lightRooms.reduce((n, r) => n + r.lights.filter(l => st[l.id].on).length, 0);
  const allOff = () => HC.lightRooms.forEach(r => r.lights.forEach(l => setD(l.id, { on: false })));
  const rooms = onlyOn
    ? HC.lightRooms.map(r => ({ ...r, lights: r.lights.filter(l => st[l.id].on) })).filter(r => r.lights.length)
    : HC.lightRooms;

  return (
    <div>
      <LargeTitle title="Lights" sub={`${totalOn} on across the house`}
        right={totalOn ? <button onClick={allOff} style={pillBtn}>All Off</button> : null} />
      <div style={{ padding: '0 18px 16px' }}>
        <Segmented options={['All Lights', 'On Now']} value={onlyOn ? 'On Now' : 'All Lights'} onChange={(v) => setOnlyOn(v === 'On Now')} />
      </div>
      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {rooms.map(r => {
          const roomOn = r.lights.some(l => st[l.id].on);
          const masterToggle = () => r.lights.forEach(l => setD(l.id, { on: !roomOn, level: !roomOn ? (st[l.id].level || 100) : st[l.id].level }));
          return (
            <Card key={r.room} pad={false} style={{ padding: '14px 14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, padding: '0 2px' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)', letterSpacing: -0.3 }}>{r.room}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500 }}>{r.lights.filter(l => st[l.id].on).length} of {r.lights.length} on</div>
                </div>
                <Toggle on={roomOn} onChange={masterToggle} accent="var(--amber)" size={0.85} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {r.lights.map(l => <LightBar key={l.id} id={l.id} name={l.name} />)}
              </div>
            </Card>
          );
        })}
        {!rooms.length && <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40, fontSize: 15 }}>No lights are on.</div>}
      </div>
    </div>
  );
}

// ════════════════════════════ DOORS ════════════════════════════
function DoorsScreen() {
  const { st, setD } = useHC();
  const lockedCount = HC.doorsExterior.filter(d => st[d.id].locked).length;
  const lockAll = () => HC.doorsExterior.forEach(d => setD(d.id, { locked: true }));
  return (
    <div>
      <LargeTitle title="Doors" sub={`${lockedCount} of ${HC.doorsExterior.length} exterior doors locked`}
        right={lockedCount < HC.doorsExterior.length ? <button onClick={lockAll} style={pillBtn}>Lock All</button> : null} />
      <div style={{ padding: '0 18px' }}>
        <SectionTitle>Exterior</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {HC.doorsExterior.map(d => {
            const locked = st[d.id].locked;
            const toggle = () => setD(d.id, { locked: !locked });
            return <Tile key={d.id} icon={locked ? 'lock' : 'unlock'} name={d.name}
              status={locked ? 'Locked' : 'Unlocked'} active={true}
              activeColor={locked ? 'var(--green)' : 'var(--red)'} onTap={toggle}
              control={<Toggle on={locked} onChange={toggle} accent="rgba(255,255,255,0.45)" size={0.78} />} />;
          })}
        </div>

        <div style={{ marginTop: 24 }}>
          <SectionTitle>Interior · Sensors</SectionTitle>
          <Card pad={false}>
            {HC.doorsInterior.map((d, i) => {
              const open = st[d.id].open;
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px',
                  borderBottom: i < HC.doorsInterior.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--icon-bg)', color: open ? 'var(--amber)' : 'var(--text2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                    <Icon name="door" size={20} />
                  </div>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>{d.name}</span>
                  {d.lowBattery && <span style={{ color: 'var(--amber)', marginRight: 10, display: 'flex' }} title="Low battery"><Icon name="battery" size={20} /></span>}
                  <span style={{ fontSize: 14, fontWeight: 640, color: open ? 'var(--amber)' : 'var(--green)' }}>{open ? 'Open' : 'Closed'}</span>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════ CLIMATE ════════════════════════════
function Dial({ temp, mode }) {
  const size = 132, r = 56, cx = size / 2, cy = size / 2;
  const start = 135, sweep = 270;
  const lo = 55, hi = 80;
  const frac = Math.max(0, Math.min(1, (temp - lo) / (hi - lo)));
  const C = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * C;
  const col = mode === 'cool' ? '#3d9be0' : mode === 'heat' ? '#e0573d' : '#E0883D';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--slider-track)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${arcLen} ${C}`} transform={`rotate(${start} ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${frac * arcLen} ${C}`} transform={`rotate(${start} ${cx} ${cy})`} />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--text)" style={{ letterSpacing: -1 }}>{temp}°</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={col} style={{ textTransform: 'capitalize' }}>{mode === 'cool' ? 'Cooling' : mode === 'heat' ? 'Heating' : 'Auto'}</text>
    </svg>
  );
}

function ClimateScreen() {
  const { st, setD } = useHC();
  const [hvac, setHvac] = React.useState('Home');
  return (
    <div>
      <LargeTitle title="Climate" sub="4 zones · Auto" />
      <div style={{ padding: '0 18px 18px' }}>
        <Segmented options={['Home', 'Away', 'Sleep']} value={hvac} onChange={setHvac} />
      </div>
      <div style={{ padding: '0 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {HC.climate.map(c => {
          const s = st[c.id];
          const nudge = (d) => setD(c.id, { temp: Math.round((s.temp + d) * 2) / 2 });
          return (
            <Card key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 12px 14px' }}>
              <div style={{ fontSize: 14.5, fontWeight: 640, color: 'var(--text)', alignSelf: 'flex-start', marginLeft: 4 }}>{c.name}</div>
              <Dial temp={s.temp} mode={s.mode} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 2 }}>
                <button onClick={() => nudge(-0.5)} style={stepBtn}><Icon name="minus" size={18} strokeWidth={2.4} /></button>
                <span style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 560, minWidth: 58, textAlign: 'center' }}>{s.lo}°–{s.hi}°</span>
                <button onClick={() => nudge(0.5)} style={stepBtn}><Icon name="plus" size={18} strokeWidth={2.4} /></button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════ EDIT FAVORITES ════════════════════════
function EditFavoritesScreen() {
  const { st, setD, back } = useHC();
  const ids = st['_favs'].ids;

  const lookup = {};
  HC.favCatalog.forEach(g => g.items.forEach(it => { lookup[it.id] = { ...it, group: g.group }; }));

  const setIds = (next) => setD('_favs', { ids: next });
  const remove = (id) => setIds(ids.filter(x => x !== id));
  const add = (id) => setIds([...ids, id]);
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = ids.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setIds(next);
  };

  const circleBtn = (color, name, onClick, disabled) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: 26, height: 26, borderRadius: 13, border: 'none', flex: '0 0 auto',
      cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: disabled ? 'var(--switch-off)' : color, color: '#fff', opacity: disabled ? 0.4 : 1,
      WebkitTapHighlightColor: 'transparent',
    }}><Icon name={name} size={16} strokeWidth={2.6} /></button>
  );

  return (
    <div>
      <LargeTitle title="Favorites" sub="Pinned to your Home dashboard"
        right={<button onClick={back} style={pillBtn}>Done</button>} />

      {/* Active favorites — reorderable */}
      <div style={{ padding: '0 18px' }}>
        <SectionTitle>On Home · {ids.length}</SectionTitle>
        {ids.length === 0 ? (
          <Card><div style={{ padding: '14px 4px', fontSize: 14.5, color: 'var(--text2)', textAlign: 'center' }}>No favorites yet — add some below.</div></Card>
        ) : (
          <Card pad={false}>
            {ids.map((id, i) => {
              const it = lookup[id] || { icon: 'bulb', label: id };
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                  borderBottom: i < ids.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                  {circleBtn('var(--red)', 'minus', () => remove(id))}
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--icon-bg)', color: 'var(--text2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                    <Icon name={it.icon} size={18} />
                  </div>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 540, color: 'var(--text)' }}>{it.label}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => move(i, -1)} disabled={i === 0} style={{ ...reorderBtn, opacity: i === 0 ? 0.3 : 1, cursor: i === 0 ? 'default' : 'pointer' }}>
                      <Icon name="chevDown" size={18} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <button onClick={() => move(i, 1)} disabled={i === ids.length - 1} style={{ ...reorderBtn, opacity: i === ids.length - 1 ? 0.3 : 1, cursor: i === ids.length - 1 ? 'default' : 'pointer' }}>
                      <Icon name="chevDown" size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {/* Add more, grouped by category */}
      {HC.favCatalog.map(g => {
        const avail = g.items.filter(it => !ids.includes(it.id));
        if (avail.length === 0) return null;
        return (
          <div key={g.group} style={{ padding: '0 18px', marginTop: 22 }}>
            <SectionTitle>{g.group}</SectionTitle>
            <Card pad={false}>
              {avail.map((it, i) => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                  borderBottom: i < avail.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                  {circleBtn('var(--green)', 'plus', () => add(it.id))}
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--icon-bg)', color: 'var(--text2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                    <Icon name={it.icon} size={18} />
                  </div>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 540, color: 'var(--text)' }}>{it.label}</span>
                </div>
              ))}
            </Card>
          </div>
        );
      })}
      <div style={{ height: 8 }} />
    </div>
  );
}

// ════════════════════════════ EDIT SCENES ════════════════════════════
function EditScenesScreen() {
  const { st, setD, back } = useHC();
  const ids = st['_scenes'].ids;

  const byId = {};
  HC.scenes.forEach(s => { byId[s.id] = s; });

  const setIds = (next) => setD('_scenes', { ids: next });
  const remove = (id) => setIds(ids.filter(x => x !== id));
  const add = (id) => setIds([...ids, id]);
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = ids.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setIds(next);
  };

  const circleBtn = (color, name, onClick) => (
    <button onClick={onClick} style={{
      width: 26, height: 26, borderRadius: 13, border: 'none', flex: '0 0 auto',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: color, color: '#fff', WebkitTapHighlightColor: 'transparent',
    }}><Icon name={name} size={16} strokeWidth={2.6} /></button>
  );

  const sceneChip = (sc) => (
    <div style={{ width: 30, height: 30, borderRadius: 9, background: sc.tint + '1f', color: sc.tint,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
      <Icon name={sc.icon} size={18} />
    </div>
  );

  const avail = HC.scenes.filter(sc => !ids.includes(sc.id));

  return (
    <div>
      <LargeTitle title="Scenes" sub="Pinned to your Home dashboard"
        right={<button onClick={back} style={pillBtn}>Done</button>} />

      {/* Active scenes — reorderable */}
      <div style={{ padding: '0 18px' }}>
        <SectionTitle>On Home · {ids.length}</SectionTitle>
        {ids.length === 0 ? (
          <Card><div style={{ padding: '14px 4px', fontSize: 14.5, color: 'var(--text2)', textAlign: 'center' }}>No scenes yet — add some below.</div></Card>
        ) : (
          <Card pad={false}>
            {ids.map((id, i) => {
              const sc = byId[id];
              if (!sc) return null;
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                  borderBottom: i < ids.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                  {circleBtn('var(--red)', 'minus', () => remove(id))}
                  {sceneChip(sc)}
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 540, color: 'var(--text)' }}>{sc.name}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => move(i, -1)} disabled={i === 0} style={{ ...reorderBtn, opacity: i === 0 ? 0.3 : 1, cursor: i === 0 ? 'default' : 'pointer' }}>
                      <Icon name="chevDown" size={18} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <button onClick={() => move(i, 1)} disabled={i === ids.length - 1} style={{ ...reorderBtn, opacity: i === ids.length - 1 ? 0.3 : 1, cursor: i === ids.length - 1 ? 'default' : 'pointer' }}>
                      <Icon name="chevDown" size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {/* Add more scenes */}
      {avail.length > 0 && (
        <div style={{ padding: '0 18px', marginTop: 22 }}>
          <SectionTitle>Add a Scene</SectionTitle>
          <Card pad={false}>
            {avail.map((sc, i) => (
              <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                borderBottom: i < avail.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                {circleBtn('var(--green)', 'plus', () => add(sc.id))}
                {sceneChip(sc)}
                <span style={{ flex: 1, fontSize: 16, fontWeight: 540, color: 'var(--text)' }}>{sc.name}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
      <div style={{ height: 8 }} />
    </div>
  );
}

// ── shared button styles ──
const iconBtn = { background: 'var(--card)', border: 'none', cursor: 'pointer', width: 40, height: 40, borderRadius: 20, color: 'var(--text)', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' };
const pillBtn = { background: 'var(--accent)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, fontWeight: 640, padding: '9px 16px', borderRadius: 20, WebkitTapHighlightColor: 'transparent' };
const stepBtn = { width: 34, height: 34, borderRadius: 17, border: 'none', cursor: 'pointer', background: 'var(--icon-bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' };
const reorderBtn = { width: 32, height: 32, borderRadius: 9, border: 'none', background: 'var(--icon-bg)', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' };

Object.assign(window, { LargeTitle, Tile, StatTile, HomeScreen, LightsScreen, DoorsScreen, ClimateScreen, EditFavoritesScreen, EditScenesScreen, iconBtn, pillBtn, stepBtn });
