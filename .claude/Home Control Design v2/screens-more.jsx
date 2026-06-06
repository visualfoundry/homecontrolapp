/* screens-more.jsx — Music, Fans, Irrigation, Leak, Motion, Outdoors, Settings, More. */
const { Icon: I2, Toggle: Tg, Slider: Sl, Card: Cd, SectionTitle: ST, Segmented: Sg, useHC: useHC2 } = window;
const { LargeTitle: LT, Tile: Tl, iconBtn: IB, pillBtn: PB, LightBar: LBar, Dial: Dial, stepBtn: SB } = window;

// reusable settings-style toggle list
function ToggleList({ items }) {
  const { st, setD } = useHC2();
  return (
    <Cd pad={false}>
      {items.map((it, i) => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px',
          borderBottom: i < items.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>{it.name}</span>
          <Tg on={st[it.id].on} onChange={(v) => setD(it.id, { on: v })} size={0.85} />
        </div>
      ))}
    </Cd>
  );
}

// ════════════════════════════ MUSIC ════════════════════════════
function MusicScreen() {
  const { st, setD } = useHC2();
  const playing = HC.musicZones.filter(m => st[m.id].on).length;
  return (
    <div>
      <LT title="Music" sub={`Shared as “Music House” · ${playing} playing`} />
      {/* Now playing */}
      <div style={{ padding: '0 18px 20px' }}>
        <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)',
          background: 'linear-gradient(135deg,#3a2f55,#6a4a7a)', padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <I2 name="speaker" size={26} />
          </div>
          <div style={{ flex: 1, minWidth: 0, color: '#fff' }}>
            <div style={{ fontSize: 15.5, fontWeight: 660, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sunday Acoustic</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>Living Room</div>
          </div>
          <div style={{ display: 'flex', gap: 8, color: '#fff' }}>
            <button style={miniBtn}><I2 name="prev" size={20} /></button>
            <button style={{ ...miniBtn, background: 'rgba(255,255,255,0.22)' }}><I2 name="pause" size={20} /></button>
            <button style={miniBtn}><I2 name="next" size={20} /></button>
          </div>
        </div>
      </div>
      <div style={{ padding: '0 18px' }}>
        <ST>Speakers</ST>
        <Cd pad={false} style={{ padding: '6px 14px' }}>
          {HC.musicZones.map((m, i) => {
            const s = st[m.id];
            return (
              <div key={m.id} style={{ padding: '13px 2px', borderBottom: i < HC.musicZones.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{m.name}</span>
                  <Tg on={s.on} onChange={(v) => setD(m.id, { on: v, vol: v && !s.vol ? 30 : s.vol })} size={0.82} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ color: 'var(--text3)', display: 'flex' }}><I2 name={s.on && s.vol ? 'volume' : 'mute'} size={20} /></span>
                  <Sl value={s.vol} onChange={(v) => setD(m.id, { vol: v, on: v > 0 })} height={30} disabled={!s.on} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', minWidth: 30, textAlign: 'right' }}>{s.on ? s.vol : '–'}</span>
                </div>
              </div>
            );
          })}
        </Cd>
      </div>
    </div>
  );
}

// ════════════════════════════ FANS ════════════════════════════
const SPEEDS = ['Off', 'Low', 'Med', 'High'];
function FansScreen() {
  const { st, setD } = useHC2();
  const onCount = HC.fans.filter(f => st[f.id].on).length;
  return (
    <div>
      <LT title="Fans" sub={`${onCount} running`} />
      <div style={{ padding: '0 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {HC.fans.map(f => {
          const s = st[f.id];
          const setSpeed = (sp) => setD(f.id, { speed: sp, on: sp > 0 });
          return (
            <Cd key={f.id} style={{ padding: 15 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: s.on ? 'var(--accent)' : 'var(--icon-bg)',
                  color: s.on ? '#fff' : 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ display: 'flex', animation: s.on ? `spin ${1.4 - s.speed * 0.3}s linear infinite` : 'none' }}><I2 name="fan" size={23} /></span>
                </div>
                <Tg on={s.on} onChange={(v) => setD(f.id, { on: v, speed: v ? Math.max(1, s.speed) : 0 })} size={0.78} accent="var(--accent)" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', margin: '13px 0 10px', letterSpacing: -0.2 }}>{f.name}</div>
              <div style={{ display: 'flex', gap: 4, background: 'var(--seg-bg)', borderRadius: 10, padding: 3 }}>
                {SPEEDS.map((sp, idx) => (
                  <button key={sp} onClick={() => setSpeed(idx)} style={{
                    flex: 1, border: 'none', cursor: 'pointer', borderRadius: 7, padding: '5px 0', fontSize: 11.5, fontWeight: 620,
                    background: s.speed === idx ? 'var(--seg-active)' : 'transparent',
                    color: s.speed === idx ? 'var(--text)' : 'var(--text3)',
                    boxShadow: s.speed === idx ? '0 1px 2px rgba(0,0,0,0.12)' : 'none' }}>{sp}</button>
                ))}
              </div>
            </Cd>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════ IRRIGATION ════════════════════════════
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SCHED = [
  { time: '6:30 am', run: [1, 1, 1, 1, 1, 1, 1] },
  { time: '2:30 pm', run: [0, 0, 0, 0, 0, 0, 0] },
  { time: '8:30 pm', run: [1, 1, 1, 1, 1, 1, 1] },
  { time: '9:00 pm', run: [0, 2, 0, 0, 2, 0, 2] },
];
function IrrigationScreen() {
  const { st, setD } = useHC2();
  const schedOn = st['_global'].irrigationSchedule;
  return (
    <div>
      <LT title="Irrigation" sub={schedOn ? 'Schedule active' : 'Schedule off'} />
      <div style={{ padding: '0 18px' }}>
        <ST>Programs</ST>
        <ToggleList items={HC.irrigationPrograms} />

        <div style={{ marginTop: 22 }}>
          <ST>Schedule</ST>
          <Cd style={{ padding: '14px 12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7,1fr)', alignItems: 'center', gap: 4 }}>
              <span />
              {DAYS.map(d => <span key={d} style={{ fontSize: 11, fontWeight: 640, color: 'var(--text2)', textAlign: 'center' }}>{d}</span>)}
              {SCHED.map(row => (
                <React.Fragment key={row.time}>
                  <span style={{ fontSize: 11.5, fontWeight: 560, color: 'var(--text2)' }}>{row.time}</span>
                  {row.run.map((v, i) => (
                    <div key={i} style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {v > 0 && <span style={{ display: 'flex', color: v === 2 ? '#7bbf4a' : '#3fa535' }}><I2 name="grass" size={v === 2 ? 17 : 19} strokeWidth={2} /></span>}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </Cd>
          <div style={{ marginTop: 12 }}>
            <Cd pad={false}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '0.5px solid var(--sep)' }}>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>Schedule On</span>
                <Tg on={schedOn} onChange={(v) => setD('_global', { irrigationSchedule: v })} size={0.85} accent="#3fa535" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px' }}>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>Skip Schedule Today</span>
                <Tg on={false} onChange={() => {}} size={0.85} />
              </div>
            </Cd>
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <ST>Zones</ST>
          <Cd pad={false}>
            {HC.irrigationZones.map((z, i) => (
              <div key={z.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: i < HC.irrigationZones.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--icon-bg)', color: '#3fa535', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                  <I2 name="droplet" size={19} />
                </div>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>{z.name}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text2)', marginRight: 12 }}>{z.mins < 1 ? '0:30' : z.mins + ':00'}</span>
                <button style={{ ...PB, background: 'var(--icon-bg)', color: 'var(--accent)', padding: '7px 14px' }}>Run</button>
              </div>
            ))}
          </Cd>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════ LEAK ════════════════════════════
function LeakScreen() {
  const { st } = useHC2();
  const wet = HC.leakSensors.filter(s => st[s.id].wet).length;
  return (
    <div>
      <LT title="Water Leak" sub={wet ? `${wet} alert` : 'All sensors dry'} />
      <div style={{ padding: '0 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--green)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 18, color: '#fff' }}>
          <I2 name="check" size={26} strokeWidth={2.4} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 680 }}>No leaks detected</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{HC.leakSensors.length} sensors reporting · Water mains open</div>
          </div>
        </div>
        <Cd pad={false}>
          {HC.leakSensors.map((s, i) => {
            const isWet = st[s.id].wet;
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: i < HC.leakSensors.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: isWet ? 'var(--red)' : 'var(--icon-bg)', color: isWet ? '#fff' : '#5a9bd4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                  <I2 name="droplet" size={19} fill={isWet ? '#fff' : 'none'} />
                </div>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>{s.name}</span>
                <span style={{ fontSize: 13.5, fontWeight: 640, color: isWet ? 'var(--red)' : 'var(--green)' }}>{isWet ? 'Leak!' : 'Dry'}</span>
              </div>
            );
          })}
        </Cd>
      </div>
    </div>
  );
}

// ════════════════════════════ MOTION ════════════════════════════
function MotionScreen() {
  const { st } = useHC2();
  const active = HC.motionSensors.filter(s => st[s.id].motion);
  return (
    <div>
      <LT title="Motion" sub={`${active.length} active now`} />
      <div style={{ padding: '0 18px' }}>
        {active.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: 'var(--accent)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 18, color: '#fff' }}>
            <I2 name="motion" size={26} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 680 }}>Motion detected</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{active.map(a => a.name).join(' · ')}</div>
            </div>
          </div>
        )}
        <Cd pad={false}>
          {HC.motionSensors.map((s, i) => {
            const m = st[s.id].motion;
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: i < HC.motionSensors.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                <span style={{ flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>{s.name}</span>
                {s.lowBattery && <span style={{ color: 'var(--amber)', marginRight: 12, display: 'flex' }} title="Low battery"><I2 name="battery" size={19} /></span>}
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: m ? 'var(--red)' : 'var(--switch-off)',
                  boxShadow: m ? '0 0 0 4px color-mix(in srgb, var(--red) 25%, transparent)' : 'none' }} />
              </div>
            );
          })}
        </Cd>
      </div>
    </div>
  );
}

// ════════════════════════════ OUTDOORS ════════════════════════════
function OutdoorsScreen() {
  const { st, setD } = useHC2();
  const tile = (o, icon) => {
    const s = st[o.id];
    return <Tl key={o.id} icon={icon} name={o.name} status={s.on ? 'On' : 'Off'} active={s.on}
      onTap={() => setD(o.id, { on: !s.on })} control={<Tg on={s.on} onChange={(v) => setD(o.id, { on: v })} accent="rgba(255,255,255,0.45)" size={0.78} />} />;
  };
  const pergola = st['ob-pergola-l'];
  return (
    <div>
      <LT title="Outdoors" sub="Pool · Backyard · Doors" />
      <div style={{ padding: '0 18px' }}>
        <ST>Pool</ST>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {tile(HC.outdoorsPool[0], 'pool')}
          {tile(HC.outdoorsPool[1], 'waterfall')}
          {tile(HC.outdoorsPool[2], 'pool')}
          {(() => {
            const s = st['ob-autolock'];
            return <Tl key="autolock" icon={s.on ? 'lock' : 'unlock'} name="Doors Auto Lock" status={s.on ? 'On' : 'Off'} active={s.on}
              activeColor="var(--green)" onTap={() => setD('ob-autolock', { on: !s.on })}
              control={<Tg on={s.on} onChange={(v) => setD('ob-autolock', { on: v })} accent="rgba(255,255,255,0.45)" size={0.78} />} />;
          })()}
        </div>

        <div style={{ marginTop: 22 }}>
          <ST>Backyard</ST>
          <Cd style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 620, color: 'var(--text)' }}>Pergola Light</span>
              <Tg on={pergola.on} onChange={(v) => setD('ob-pergola-l', { on: v, level: v ? (pergola.level || 70) : pergola.level })} accent="var(--amber)" size={0.85} />
            </div>
            <div style={{ position: 'relative', height: 44, borderRadius: 14, overflow: 'hidden', background: 'var(--slider-track)' }}>
              <Sl value={pergola.on ? pergola.level : 0} onChange={(v) => setD('ob-pergola-l', { level: v, on: v > 0 })} height={44} track="transparent" fill="linear-gradient(90deg,#f5b942,#ffd86b)" />
              <span style={{ position: 'absolute', right: 14, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 13.5, fontWeight: 600, color: pergola.on ? '#7a5200' : 'var(--text3)', pointerEvents: 'none' }}>{pergola.on ? pergola.level + '%' : 'Off'}</span>
            </div>
          </Cd>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {tile(HC.outdoorsBackyard[1], 'fan')}
            {tile(HC.outdoorsBackyard[2], 'grass')}
            {tile(HC.outdoorsBackyard[3], 'water')}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════ GARAGE ════════════════════════════
function GarageScreen() {
  const { st, setD } = useHC2();
  const doors = HC.garageDoors.map(d => ({ ...d, open: st[d.id].open }));
  const openCount = doors.filter(d => d.open).length;
  const setAll = (open) => doors.forEach(d => { if (d.open !== open) setD(d.id, { open }); });
  return (
    <div>
      <LT title="Garage" sub={openCount > 0 ? `${openCount} of ${doors.length} doors open` : 'All doors closed'}
        right={openCount > 0
          ? <button onClick={() => setAll(false)} style={PB}>Close All</button>
          : <button onClick={() => setAll(true)} style={PB}>Open All</button>} />
      <div style={{ padding: '0 18px' }}>
        <ST>Garage Doors</ST>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {doors.map(d => {
            const toggle = () => setD(d.id, { open: !d.open });
            return (
              <Tl key={d.id} icon="garage" name={d.name} status={d.open ? 'Open' : 'Closed'}
                active={d.open} activeColor="var(--amber)" onTap={toggle}
                control={<Tg on={d.open} onChange={toggle} accent="rgba(255,255,255,0.45)" size={0.78} />} />
            );
          })}
        </div>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

// ════════════════════════════ CINEMA ════════════════════════════
function CinemaScreen() {
  const { st, setD } = useHC2();
  const sceneTile = (id, icon, name, onL, offL) => {
    const s = st[id];
    return <Tl key={id} icon={icon} name={name} status={s.on ? (onL || 'On') : (offL || 'Off')} active={s.on}
      onTap={() => setD(id, { on: !s.on })}
      control={<Tg on={s.on} onChange={(v) => setD(id, { on: v })} accent="rgba(255,255,255,0.45)" size={0.78} />} />;
  };
  const cinLights = HC.lightRooms.find(r => r.room === 'Cinema').lights;
  const lightsOn = cinLights.filter(l => st[l.id].on).length;
  const roomOn = lightsOn > 0;
  const masterToggle = () => cinLights.forEach(l => setD(l.id, { on: !roomOn, level: !roomOn ? (st[l.id].level || 100) : st[l.id].level }));
  const zone = HC.climate.find(c => c.id === 'cl-2c');
  const cs = st['cl-2c'];
  const nudge = (d) => setD('cl-2c', { temp: Math.round((cs.temp + d) * 2) / 2 });
  const door = st['i-cinema'];

  return (
    <div>
      <LT title="Cinema" sub="Screen · Lights · Climate" />
      <div style={{ padding: '0 18px' }}>
        <ST>Theater</ST>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {sceneTile('e-cin-tv', 'film', 'Theatre')}
          {sceneTile('e-cin-scr', 'chevDown', 'Screen Down')}
          {sceneTile('e-cin-shades', 'shades', 'Window Shades', 'Up', 'Down')}
        </div>

        <div style={{ marginTop: 22 }}>
          <ST>Lights</ST>
          <Cd pad={false} style={{ padding: '14px 14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, padding: '0 2px' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)', letterSpacing: -0.3 }}>Cinema</div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500 }}>{lightsOn} of {cinLights.length} on</div>
              </div>
              <Tg on={roomOn} onChange={masterToggle} accent="var(--amber)" size={0.85} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cinLights.map(l => <LBar key={l.id} id={l.id} name={l.name} />)}
            </div>
          </Cd>
        </div>

        <div style={{ marginTop: 22 }}>
          <ST>Climate</ST>
          <Cd style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
            <Dial temp={cs.temp} mode={cs.mode} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 660, color: 'var(--text)' }}>{zone.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, marginTop: 2 }}>Range {cs.lo}°–{cs.hi}°</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
                <button onClick={() => nudge(-0.5)} style={SB}><I2 name="minus" size={18} strokeWidth={2.4} /></button>
                <span style={{ fontSize: 15, fontWeight: 680, color: 'var(--text)', minWidth: 44, textAlign: 'center' }}>{cs.temp}°</span>
                <button onClick={() => nudge(0.5)} style={SB}><I2 name="plus" size={18} strokeWidth={2.4} /></button>
              </div>
            </div>
          </Cd>
        </div>

        <div style={{ marginTop: 22 }}>
          <ST>Room</ST>
          <Cd pad={false}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--icon-bg)', color: door.open ? 'var(--amber)' : 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
                <I2 name="door" size={20} />
              </div>
              <span style={{ flex: 1, fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>Cinema Door</span>
              <span style={{ fontSize: 14, fontWeight: 640, color: door.open ? 'var(--amber)' : 'var(--green)' }}>{door.open ? 'Open' : 'Closed'}</span>
            </div>
          </Cd>
        </div>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

// ════════════════════════ SETTINGS ════════════════════════
function SettingsScreen() {
  const { st, setD, t, setTweak } = useHC2();
  return (
    <div>
      <LT title="Settings" />
      <div style={{ padding: '0 18px' }}>
        <ST>Appearance</ST>
        <Cd pad={false}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--icon-bg)', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 13 }}>
              <I2 name="moon" size={19} />
            </div>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>Dark Mode</span>
            <Tg on={t.dark} onChange={(v) => setTweak('dark', v)} size={0.85} />
          </div>
        </Cd>

        <div style={{ marginTop: 22 }}><ST>Security</ST><ToggleList items={HC.settingsSecurity} /></div>
        <div style={{ marginTop: 22 }}><ST>Environment</ST><ToggleList items={HC.settingsEnvironment} /></div>
        <div style={{ marginTop: 22 }}><ST>Schedules</ST><ToggleList items={HC.settingsSchedules} /></div>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

// ════════════════════════════ MORE ════════════════════════════
function MoreScreen() {
  const { go, t, sections } = useHC2();
  const ids = Object.keys(sections).filter(id => !t.tabs.includes(id));
  return (
    <div>
      <LT title="More" right={<button onClick={() => go('customize')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 16, fontWeight: 620, padding: 0 }}>Edit</button>} />
      <div style={{ padding: '0 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {ids.map(id => {
          const it = sections[id];
          return (
            <Cd key={id} onClick={() => go(id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13, padding: '17px 16px' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: it.tint + '22', color: it.tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <I2 name={it.icon} size={23} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 620, color: 'var(--text)' }}>{it.name}</span>
            </Cd>
          );
        })}
      </div>
      <div style={{ padding: '20px 18px 0' }}>
        <button onClick={() => go('customize')} style={{ width: '100%', background: 'var(--card)', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, color: 'var(--accent)', fontSize: 15.5, fontWeight: 620 }}>
          <I2 name="grid" size={20} /> Customize Tab Bar
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════ CUSTOMIZE TAB BAR ════════════════════════════
function CustomizeScreen() {
  const { t, setTweak, sections, maxTabs } = useHC2();
  const tabs = t.tabs;
  const more = Object.keys(sections).filter(id => !tabs.includes(id));
  const full = tabs.length >= maxTabs;

  const add = (id) => { if (!full) setTweak('tabs', [...tabs, id]); };
  const remove = (id) => { if (tabs.length > 1) setTweak('tabs', tabs.filter(x => x !== id)); };
  const move = (id, dir) => {
    const i = tabs.indexOf(id), j = i + dir;
    if (j < 0 || j >= tabs.length) return;
    const a = [...tabs]; [a[i], a[j]] = [a[j], a[i]]; setTweak('tabs', a);
  };

  const iconChip = (it) => (
    <div style={{ width: 38, height: 38, borderRadius: 11, background: it.tint + '22', color: it.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <I2 name={it.icon} size={21} />
    </div>
  );
  const roundBtn = (children, onClick, disabled, color) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: 32, height: 32, borderRadius: 16, border: 'none', flexShrink: 0,
      cursor: disabled ? 'default' : 'pointer', background: disabled ? 'var(--icon-bg)' : (color || 'var(--icon-bg)'),
      color: disabled ? 'var(--text3)' : (color ? '#fff' : 'var(--text)'),
      display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1,
      WebkitTapHighlightColor: 'transparent',
    }}>{children}</button>
  );

  return (
    <div>
      <LT title="Customize" sub={`Up to ${maxTabs} shortcuts on the bar · More is always last`} />
      <div style={{ padding: '0 18px' }}>
        <ST>On the Tab Bar</ST>
        <Cd pad={false}>
          {tabs.map((id, i) => {
            const it = sections[id];
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: '0.5px solid var(--sep)' }}>
                {iconChip(it)}
                <span style={{ flex: 1, fontSize: 16, fontWeight: 580, color: 'var(--text)' }}>{it.name}</span>
                <div style={{ display: 'flex', gap: 6, marginRight: 4 }}>
                  {roundBtn(<I2 name="chevDown" size={17} strokeWidth={2.4} style={{ transform: 'rotate(180deg)' }} />, () => move(id, -1), i === 0)}
                  {roundBtn(<I2 name="chevDown" size={17} strokeWidth={2.4} />, () => move(id, 1), i === tabs.length - 1)}
                </div>
                {roundBtn(<I2 name="minus" size={18} strokeWidth={2.6} />, () => remove(id), tabs.length <= 1, 'var(--red)')}
              </div>
            );
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', opacity: 0.6 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--icon-bg)', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <I2 name="grid" size={21} />
            </div>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 580, color: 'var(--text)' }}>More</span>
            <span style={{ fontSize: 13, fontWeight: 560, color: 'var(--text3)', marginRight: 6 }}>Pinned</span>
          </div>
        </Cd>

        <div style={{ marginTop: 22 }}>
          <ST>{full ? 'In More · bar is full' : 'In More · tap + to add'}</ST>
          <Cd pad={false}>
            {more.map((id, i) => {
              const it = sections[id];
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: i < more.length - 1 ? '0.5px solid var(--sep)' : 'none' }}>
                  {iconChip(it)}
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 580, color: 'var(--text)' }}>{it.name}</span>
                  {roundBtn(<I2 name="plus" size={18} strokeWidth={2.6} />, () => add(id), full, full ? null : 'var(--green)')}
                </div>
              );
            })}
            {!more.length && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 15 }}>Everything is on the tab bar.</div>}
          </Cd>
        </div>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

// ════════════════════════════ DOCS ════════════════════════════
function DocsScreen() {
  const general = ['Home Climate', 'Music', 'Pet Care', 'Deliveries & Home Services', 'Swimming Pool', 'General TVs', 'Living Room TV', 'Cinema', 'Irrigation & Watering', 'Lighting', 'Contacts', 'Security', 'Overview'];
  const family = ['Manuals', 'Inventory', 'Services & Maintenance'];
  const list = (title, arr) => (
    <div style={{ marginTop: 22 }}>
      <ST>{title}</ST>
      <Cd pad={false}>
        {arr.map((d, i) => (
          <div key={d} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: i < arr.length - 1 ? '0.5px solid var(--sep)' : 'none', cursor: 'pointer' }}>
            <span style={{ flex: 1, fontSize: 16, fontWeight: 520, color: 'var(--text)' }}>{d}</span>
            <span style={{ color: 'var(--text3)', display: 'flex' }}><I2 name="chevron" size={17} /></span>
          </div>
        ))}
      </Cd>
    </div>
  );
  return (
    <div>
      <LT title="Documentation" />
      <div style={{ padding: '0 18px' }}>
        {list('General Documents', general)}
        {list('Family Only', family)}
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

const miniBtn = { width: 38, height: 38, borderRadius: 19, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' };

Object.assign(window, { MusicScreen, FansScreen, IrrigationScreen, LeakScreen, MotionScreen, OutdoorsScreen, GarageScreen, CinemaScreen, SettingsScreen, MoreScreen, CustomizeScreen, DocsScreen });
