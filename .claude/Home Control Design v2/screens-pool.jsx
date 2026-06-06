/* screens-pool.jsx — Pool equipment: variable-speed pump, heater, pH, chlorinator
   + an editable multi-schedule editor (start/end/speed-or-temp/days/enabled). */
const { Icon: PI, Toggle: PT, Slider: PS, Card: PC, SectionTitle: PST, useHC: usePHC } = window;
const { LargeTitle: PLT, iconBtn: PIB, Tile: PTile } = window;

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const fmtTime = (hhmm) => {
  let [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
};
const daysSummary = (d) => {
  const on = d.map((v, i) => v ? i : -1).filter(i => i >= 0);
  if (on.length === 7) return 'Every day';
  if (on.length === 0) return 'Never';
  const wk = [1, 2, 3, 4, 5], we = [0, 6];
  if (on.length === 5 && wk.every(i => d[i])) return 'Weekdays';
  if (on.length === 2 && we.every(i => d[i])) return 'Weekends';
  return on.map(i => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]).join(', ');
};

// ── small reading tile ──
function Reading({ icon, label, value, tint, status }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 20, boxShadow: 'var(--shadow)', padding: '13px 15px', minWidth: 116, flex: '0 0 auto' }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: tint + '22', color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 9 }}>
        <PI name={icon} size={18} strokeWidth={2} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 720, color: 'var(--text)', letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: status ? tint : 'var(--text2)', fontWeight: status ? 640 : 500, marginTop: 1 }}>{status || label}</div>
    </div>
  );
}

// ── day-of-week chip row ──
function DayChips({ days, onToggle, small }) {
  return (
    <div style={{ display: 'flex', gap: small ? 5 : 7 }}>
      {DOW.map((d, i) => {
        const on = days[i];
        const sz = small ? 26 : 34;
        return (
          <button key={i} onClick={() => onToggle && onToggle(i)} disabled={!onToggle} style={{
            width: sz, height: sz, borderRadius: '50%', border: 'none', flexShrink: 0,
            cursor: onToggle ? 'pointer' : 'default', fontSize: small ? 11.5 : 13, fontWeight: 660,
            background: on ? 'var(--accent)' : 'var(--icon-bg)', color: on ? '#fff' : 'var(--text3)',
            WebkitTapHighlightColor: 'transparent',
          }}>{d}</button>
        );
      })}
    </div>
  );
}

// ── schedule list (shared by pump & heater) ──
function Schedules({ kind, list, onEdit, onAdd, onToggle }) {
  return (
    <div>
      <PC pad={false}>
        {list.map((s, i) => (
          <div key={s.id} onClick={() => onEdit(s)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', borderBottom: i < list.length - 1 ? '0.5px solid var(--sep)' : 'none', opacity: s.enabled ? 1 : 0.55 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 640, color: 'var(--text)', letterSpacing: -0.2 }}>
                {fmtTime(s.start)} – {fmtTime(s.end)}
                <span style={{ color: 'var(--accent)', marginLeft: 8, fontWeight: 680 }}>{kind === 'pump' ? s.speed + '%' : s.target + '°'}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500, marginTop: 2 }}>{daysSummary(s.days)}</div>
            </div>
            <PT on={s.enabled} onChange={() => onToggle(s.id)} size={0.78} />
            <span style={{ color: 'var(--text3)', display: 'flex' }}><PI name="chevron" size={16} /></span>
          </div>
        ))}
        {!list.length && <div style={{ padding: 18, textAlign: 'center', color: 'var(--text3)', fontSize: 14.5 }}>No schedules yet.</div>}
      </PC>
      <button onClick={onAdd} style={{ marginTop: 10, width: '100%', background: 'var(--card)', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow)', borderRadius: 16, padding: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--accent)', fontSize: 15, fontWeight: 640, WebkitTapHighlightColor: 'transparent' }}>
        <PI name="plus" size={19} strokeWidth={2.4} /> Add Schedule
      </button>
    </div>
  );
}

// ── presets row ──
function Presets({ options, value, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map(o => {
        const on = value === o.v;
        return (
          <button key={o.label} onClick={() => onPick(o.v)} style={{
            flex: 1, border: 'none', cursor: 'pointer', borderRadius: 13, padding: '11px 0', fontSize: 14, fontWeight: 660,
            background: on ? 'var(--accent)' : 'var(--icon-bg)', color: on ? '#fff' : 'var(--text)',
            WebkitTapHighlightColor: 'transparent', transition: 'background .15s',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

// ════════════════════════════ POOL ════════════════════════════
function PoolScreen() {
  const { st, setD, overlay } = usePHC();
  const p = st['pool'];
  const setP = (patch) => setD('pool', patch);
  const [editor, setEditor] = React.useState(null); // {kind, id, draft}

  const heaterRunning = p.heaterOn && p.poolTemp < p.heaterTarget;
  const phStatus = p.ph < 7.2 ? 'Low' : p.ph > 7.8 ? 'High' : 'Ideal';
  const phTint = phStatus === 'Ideal' ? 'var(--green)' : 'var(--red)';

  // schedule helpers
  const key = (k) => k === 'pump' ? 'pumpSchedules' : 'heaterSchedules';
  const toggleSched = (kind, id) => setP({ [key(kind)]: p[key(kind)].map(s => s.id === id ? { ...s, enabled: !s.enabled } : s) });
  const openAdd = (kind) => setEditor({ kind, id: null, draft: kind === 'pump'
    ? { enabled: true, start: '08:00', end: '10:00', speed: 65, days: [true, true, true, true, true, true, true] }
    : { enabled: true, start: '07:00', end: '09:00', target: 84, days: [true, true, true, true, true, true, true] } });
  const openEdit = (kind, s) => setEditor({ kind, id: s.id, draft: { ...s, days: [...s.days] } });
  const saveSched = () => {
    const { kind, id, draft } = editor; const k = key(kind);
    const list = id ? p[k].map(s => s.id === id ? { ...draft, id } : s) : [...p[k], { ...draft, id: 'sch' + Date.now() }];
    setP({ [k]: list }); setEditor(null);
  };
  const deleteSched = () => {
    const { kind, id } = editor; if (!id) return setEditor(null);
    setP({ [key(kind)]: p[key(kind)].filter(s => s.id !== id) }); setEditor(null);
  };

  const sectionCard = (children) => <PC style={{ marginBottom: 0 }}>{children}</PC>;

  return (
    <div>
      <PLT title="Pool" sub={`${p.poolTemp}° · ${heaterRunning ? 'Heating' : p.pumpOn ? 'Pump running' : 'Idle'}`} />

      {/* Readings */}
      <div style={{ display: 'flex', gap: 11, overflowX: 'auto', padding: '0 18px 4px', scrollbarWidth: 'none' }}>
        <Reading icon="thermo" label="Pool temp" value={p.poolTemp + '°'} tint="#E07B53" />
        <Reading icon="bolt" label="Heater" value={p.heaterOn ? p.heaterTarget + '°' : 'Off'} tint="#E0573D" status={heaterRunning ? 'Running' : p.heaterOn ? 'Idle' : null} />
        <Reading icon="droplet" label="pH" value={p.ph.toFixed(1)} tint={phTint} status={phStatus} />
        <Reading icon="water" label="Salt" value={(p.saltPPM / 1000).toFixed(1) + 'k'} tint="#5a9bd4" />
        <Reading icon="power" label="ORP now" value={p.orpNow + 'mV'} tint="#2bb3a3" />
      </div>

      {/* LIGHTING & FEATURES */}
      <div style={{ padding: '22px 18px 0' }}>
        <PST>Lighting & Features</PST>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { id: 'op-light',  icon: 'bulb',      name: 'Pool Light',      light: true },
            { id: 'op-falllt', icon: 'bulb',      name: 'Waterfall Light', light: true },
            { id: 'op-fall',   icon: 'waterfall', name: 'Waterfall',       light: false },
          ].map(o => {
            const on = st[o.id].on;
            const color = o.light ? 'var(--amber)' : '#2bb3a3';
            return <PTile key={o.id} icon={o.icon} name={o.name} status={on ? 'On' : 'Off'} active={on}
              activeColor={color} glow={o.light} onTap={() => setD(o.id, { on: !on })}
              control={<PT on={on} onChange={(v) => setD(o.id, { on: v })} accent="rgba(255,255,255,0.45)" size={0.78} />} />;
          })}
        </div>
      </div>

      {/* PUMP */}
      <div style={{ padding: '22px 18px 0' }}>
        <PST>Pump</PST>
        {sectionCard(
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)' }}>Variable Speed</div>
                <div style={{ fontSize: 13, color: p.pumpOn ? 'var(--accent)' : 'var(--text2)', fontWeight: 560, marginTop: 1 }}>{p.pumpOn ? `Running · ${p.pumpSpeed}%` : 'Off'}</div>
              </div>
              <PT on={p.pumpOn} onChange={(v) => setP({ pumpOn: v })} size={0.92} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 40, fontWeight: 730, letterSpacing: -1.5, color: p.pumpOn ? 'var(--text)' : 'var(--text3)' }}>{p.pumpOn ? p.pumpSpeed : 0}</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text2)' }}>%</span>
            </div>
            <div style={{ marginBottom: 14, opacity: p.pumpOn ? 1 : 0.5 }}>
              <PS value={p.pumpSpeed} onChange={(v) => setP({ pumpSpeed: v, pumpOn: v > 0 })} height={44} fill="linear-gradient(90deg,#2bb3a3,#48cbbb)" disabled={!p.pumpOn} />
            </div>
            <Presets options={[{ label: 'Low', v: 30 }, { label: 'Medium', v: 65 }, { label: 'High', v: 100 }]}
              value={p.pumpSpeed} onPick={(v) => setP({ pumpSpeed: v, pumpOn: true })} />
          </div>
        )}
        <div style={{ height: 14 }} />
        <Schedules kind="pump" list={p.pumpSchedules} onEdit={(s) => openEdit('pump', s)} onAdd={() => openAdd('pump')} onToggle={(id) => toggleSched('pump', id)} />
      </div>

      {/* HEATER */}
      <div style={{ padding: '24px 18px 0' }}>
        <PST>Heater</PST>
        {sectionCard(
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)' }}>Pool Heater</div>
                <div style={{ fontSize: 13, color: heaterRunning ? 'var(--red)' : 'var(--text2)', fontWeight: 560, marginTop: 1 }}>{heaterRunning ? 'Running' : p.heaterOn ? 'Idle · at temp' : 'Off'}</div>
              </div>
              <PT on={p.heaterOn} onChange={(v) => setP({ heaterOn: v })} size={0.92} accent="#E0573D" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--icon-bg)', borderRadius: 16, padding: '14px 18px' }}>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 560 }}>Current</div>
                <div style={{ fontSize: 26, fontWeight: 720, color: 'var(--text)', letterSpacing: -0.5 }}>{p.poolTemp}°</div>
              </div>
              <PI name="chevron" size={18} style={{ color: 'var(--text3)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button onClick={() => setP({ heaterTarget: Math.max(60, p.heaterTarget - 1) })} style={poolStep}><PI name="minus" size={18} strokeWidth={2.4} /></button>
                <div style={{ textAlign: 'center', minWidth: 54 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 560 }}>Target</div>
                  <div style={{ fontSize: 26, fontWeight: 720, color: '#E0573D', letterSpacing: -0.5 }}>{p.heaterTarget}°</div>
                </div>
                <button onClick={() => setP({ heaterTarget: Math.min(95, p.heaterTarget + 1) })} style={poolStep}><PI name="plus" size={18} strokeWidth={2.4} /></button>
              </div>
            </div>
          </div>
        )}
        <div style={{ height: 14 }} />
        <Schedules kind="heater" list={p.heaterSchedules} onEdit={(s) => openEdit('heater', s)} onAdd={() => openAdd('heater')} onToggle={(id) => toggleSched('heater', id)} />
      </div>

      {/* WATER CHEMISTRY */}
      <div style={{ padding: '24px 18px 0' }}>
        <PST>Water Chemistry</PST>
        {/* pH */}
        <PC style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)' }}>pH Balance</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, marginTop: 1 }}>Current reading</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 30, fontWeight: 730, color: 'var(--text)', letterSpacing: -0.5 }}>{p.ph.toFixed(1)}</span>
              <span style={{ fontSize: 12.5, fontWeight: 680, color: '#fff', background: phTint, borderRadius: 8, padding: '4px 9px' }}>{phStatus}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 560, color: 'var(--text2)' }}>Target pH</span>
            <span style={{ fontSize: 15, fontWeight: 680, color: 'var(--accent)' }}>{p.phTarget.toFixed(1)}</span>
          </div>
          <PS value={p.phTarget} onChange={(v) => setP({ phTarget: v })} min={7} max={8} step={0.1} height={40} fill="linear-gradient(90deg,#5a9bd4,#48cbbb)" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 12, color: 'var(--text3)', fontWeight: 560 }}>
            <span>7.0</span><span>Ideal 7.4–7.6</span><span>8.0</span>
          </div>
        </PC>
        {/* Chlorinator */}
        <PC>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)' }}>Chlorinator</div>
              <div style={{ fontSize: 13, color: p.chlorinatorOn ? 'var(--green)' : 'var(--text2)', fontWeight: 560, marginTop: 1 }}>{p.chlorinatorOn ? 'Chlorinating' : 'Off'}</div>
            </div>
            <PT on={p.chlorinatorOn} onChange={(v) => setP({ chlorinatorOn: v })} size={0.92} accent="var(--green)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 560, color: 'var(--text2)' }}>ORP set point</span>
            <span style={{ fontSize: 15, fontWeight: 680, color: 'var(--accent)' }}>{p.orpSet} mV</span>
          </div>
          <PS value={p.orpSet} onChange={(v) => setP({ orpSet: v })} min={600} max={800} step={5} height={40} fill="linear-gradient(90deg,#2bb3a3,#48cbbb)" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 12, color: 'var(--text3)', fontWeight: 560 }}>
            <span>600 mV</span><span>Now {p.orpNow} mV</span><span>800 mV</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '0.5px solid var(--sep)' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Average salt</span>
            <span style={{ fontSize: 15, fontWeight: 680, color: 'var(--text)' }}>{p.saltPPM.toLocaleString()} ppm</span>
          </div>
        </PC>
        <div style={{ height: 8 }} />
      </div>

      {editor && <ScheduleEditor editor={editor} setEditor={setEditor} onSave={saveSched} onDelete={deleteSched} overlay={overlay} />}
    </div>
  );
}

// ── Schedule editor bottom sheet ──
function ScheduleEditor({ editor, setEditor, onSave, onDelete, overlay }) {
  const { kind, id, draft } = editor;
  const upd = (patch) => setEditor({ ...editor, draft: { ...draft, ...patch } });
  const toggleDay = (i) => { const d = [...draft.days]; d[i] = !d[i]; upd({ days: d }); };
  const presets = kind === 'pump'
    ? [{ label: 'Low', v: 30 }, { label: 'Medium', v: 65 }, { label: 'High', v: 100 }]
    : null;
  const sheet = (
    <div onClick={() => setEditor(null)} style={{ position: 'absolute', inset: 0, zIndex: 100, pointerEvents: 'auto', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--bg)', borderRadius: '26px 26px 0 0', padding: '10px 20px 30px', maxHeight: '88%', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ width: 38, height: 5, borderRadius: 3, background: 'var(--text3)', margin: '0 auto 14px', opacity: 0.5 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button onClick={() => setEditor(null)} style={sheetTxtBtn}>Cancel</button>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{id ? 'Edit Schedule' : 'New Schedule'}</span>
          <button onClick={onSave} style={{ ...sheetTxtBtn, color: 'var(--accent)', fontWeight: 700 }}>Save</button>
        </div>

        <div style={{ background: 'var(--card)', borderRadius: 18, padding: '4px 16px', marginBottom: 16, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '0.5px solid var(--sep)' }}>
            <span style={{ fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>Enabled</span>
            <PT on={draft.enabled} onChange={(v) => upd({ enabled: v })} size={0.85} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '0.5px solid var(--sep)' }}>
            <span style={{ fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>Start time</span>
            <input type="time" value={draft.start} onChange={(e) => upd({ start: e.target.value })} style={timeInput} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0' }}>
            <span style={{ fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>End time</span>
            <input type="time" value={draft.end} onChange={(e) => upd({ end: e.target.value })} style={timeInput} />
          </div>
        </div>

        {/* speed or temp */}
        <div style={{ background: 'var(--card)', borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{kind === 'pump' ? 'Pump speed' : 'Target temp'}</span>
            <span style={{ fontSize: 17, fontWeight: 720, color: 'var(--accent)' }}>{kind === 'pump' ? draft.speed + '%' : draft.target + '°'}</span>
          </div>
          {kind === 'pump' ? (
            <>
              <div style={{ marginBottom: 12 }}><PS value={draft.speed} onChange={(v) => upd({ speed: v })} height={42} fill="linear-gradient(90deg,#2bb3a3,#48cbbb)" /></div>
              <Presets options={presets} value={draft.speed} onPick={(v) => upd({ speed: v })} />
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
              <button onClick={() => upd({ target: Math.max(60, draft.target - 1) })} style={poolStep}><PI name="minus" size={20} strokeWidth={2.4} /></button>
              <span style={{ fontSize: 38, fontWeight: 730, color: 'var(--text)', letterSpacing: -1, minWidth: 70, textAlign: 'center' }}>{draft.target}°</span>
              <button onClick={() => upd({ target: Math.min(95, draft.target + 1) })} style={poolStep}><PI name="plus" size={20} strokeWidth={2.4} /></button>
            </div>
          )}
        </div>

        {/* days */}
        <div style={{ background: 'var(--card)', borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 13 }}>Repeat</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><DayChips days={draft.days} onToggle={toggleDay} /></div>
        </div>

        {id && (
          <button onClick={onDelete} style={{ width: '100%', background: 'var(--card)', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow)', borderRadius: 16, padding: '14px', color: 'var(--red)', fontSize: 16, fontWeight: 640, WebkitTapHighlightColor: 'transparent' }}>Delete Schedule</button>
        )}
      </div>
    </div>
  );
  return overlay && overlay.current ? ReactDOM.createPortal(sheet, overlay.current) : null;
}

const poolStep = { width: 38, height: 38, borderRadius: 19, border: 'none', cursor: 'pointer', background: 'var(--card)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow)', WebkitTapHighlightColor: 'transparent' };
const sheetTxtBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 16, fontWeight: 560, padding: 0, WebkitTapHighlightColor: 'transparent' };
const timeInput = { border: 'none', background: 'var(--icon-bg)', color: 'var(--text)', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', borderRadius: 9, padding: '7px 10px', WebkitTapHighlightColor: 'transparent' };

Object.assign(window, { PoolScreen });
