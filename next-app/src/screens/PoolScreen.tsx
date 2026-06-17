'use client';

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { Slider } from '@/components/Slider';
import { Tile } from '@/components/Tile';
import { LargeTitle } from '@/components/LargeTitle';
import { poolStep } from '@/lib/styles';
import type { PoolState, PoolNodeState, PumpScheduleItem, HeaterScheduleItem, OutdoorState } from '@/types/state';

const POOL_DEFAULT: PoolState = {
  pumpOn: false, pumpSpeed: 65,
  heaterOn: false, heaterRunning: false,
  poolTemp: 0, heaterTarget: 82,
  ph: 7.4, phTarget: 7.4,
  chlorinatorOn: false, orpSet: 700, orpNow: 650,
  saltPPM: 3200,
  pumpSchedules: [], heaterSchedules: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

function daysSummary(days: boolean[]): string {
  const on = days.reduce<number[]>((acc, v, i) => (v ? [...acc, i] : acc), []);
  if (on.length === 7) return 'Every day';
  if (on.length === 0) return 'Never';
  if (on.length === 5 && [1,2,3,4,5].every(i => days[i])) return 'Weekdays';
  if (on.length === 2 && [0,6].every(i => days[i])) return 'Weekends';
  return on.map(i => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]).join(', ');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Reading({ icon, label, value, tint, status }: {
  icon: IconName; label: string; value: string; tint: string; status?: string | null;
}) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 20, boxShadow: 'var(--shadow)', padding: '13px 15px', minWidth: 116, flex: '0 0 auto' }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: tint + '22', color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 9 }}>
        <Icon name={icon} size={18} strokeWidth={2} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 720, color: 'var(--text)', letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: status ? tint : 'var(--text2)', fontWeight: status ? 640 : 500, marginTop: 1 }}>
        {status || label}
      </div>
    </div>
  );
}

function DayChips({ days, onToggle }: { days: boolean[]; onToggle?: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 7 }}>
      {DOW.map((d, i) => (
        <button key={i} onClick={() => onToggle?.(i)} disabled={!onToggle} style={{
          width: 34, height: 34, borderRadius: '50%', border: 'none', flexShrink: 0,
          cursor: onToggle ? 'pointer' : 'default', fontSize: 13, fontWeight: 660,
          background: days[i] ? 'var(--accent)' : 'var(--icon-bg)',
          color: days[i] ? '#fff' : 'var(--text3)',
          WebkitTapHighlightColor: 'transparent',
        }}>{d}</button>
      ))}
    </div>
  );
}

function Presets({ options, value, onPick }: {
  options: { label: string; v: number }[];
  value: number;
  onPick: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map(o => (
        <button key={o.label} onClick={() => onPick(o.v)} style={{
          flex: 1, border: 'none', cursor: 'pointer', borderRadius: 13, padding: '11px 0',
          fontSize: 14, fontWeight: 660,
          background: value === o.v ? 'var(--accent)' : 'var(--icon-bg)',
          color: value === o.v ? '#fff' : 'var(--text)',
          WebkitTapHighlightColor: 'transparent', transition: 'background .15s',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

type ScheduleKind = 'pump' | 'heater';
type AnySchedule = PumpScheduleItem | HeaterScheduleItem;

function Schedules({ kind, list, onEdit, onAdd, onToggle }: {
  kind: ScheduleKind;
  list: AnySchedule[];
  onEdit: (s: AnySchedule) => void;
  onAdd: () => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <Card pad={false}>
        {list.length === 0 && (
          <div style={{ padding: 18, textAlign: 'center', color: 'var(--text3)', fontSize: 14.5 }}>No schedules yet.</div>
        )}
        {list.map((s, i) => (
          <div key={s.id} onClick={() => onEdit(s)} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer',
            borderBottom: i < list.length - 1 ? '0.5px solid var(--sep)' : 'none',
            opacity: s.enabled ? 1 : 0.55,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 640, color: 'var(--text)', letterSpacing: -0.2 }}>
                {fmtTime(s.start)} – {fmtTime(s.end)}
                <span style={{ color: 'var(--accent)', marginLeft: 8, fontWeight: 680 }}>
                  {kind === 'pump'
                    ? (s as PumpScheduleItem).speed + '%'
                    : (s as HeaterScheduleItem).target + '°'}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500, marginTop: 2 }}>
                {daysSummary(s.days as boolean[])}
              </div>
            </div>
            <Toggle on={s.enabled} onChange={() => onToggle(s.id)} size={0.78} />
            <span style={{ color: 'var(--text3)', display: 'flex' }}><Icon name="chevron" size={16} /></span>
          </div>
        ))}
      </Card>
      <button onClick={onAdd} style={{
        marginTop: 10, width: '100%', background: 'var(--card)', border: 'none', cursor: 'pointer',
        boxShadow: 'var(--shadow)', borderRadius: 16, padding: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        color: 'var(--accent)', fontSize: 15, fontWeight: 640,
        WebkitTapHighlightColor: 'transparent',
      }}>
        <Icon name="plus" size={19} strokeWidth={2.4} /> Add Schedule
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule editor bottom sheet (portal)
// ---------------------------------------------------------------------------

const sheetTxtBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)',
  fontSize: 16, fontWeight: 560, padding: 0, WebkitTapHighlightColor: 'transparent',
};
const timeInput: React.CSSProperties = {
  border: 'none', background: 'var(--icon-bg)', color: 'var(--text)', fontSize: 15,
  fontWeight: 600, fontFamily: 'inherit', borderRadius: 9, padding: '7px 10px',
  WebkitTapHighlightColor: 'transparent',
};

type EditorState = { kind: ScheduleKind; id: string | null; draft: AnySchedule };

function ScheduleEditor({ editor, setEditor, onSave, onDelete, portalTarget }: {
  editor: EditorState;
  setEditor: (e: EditorState | null) => void;
  onSave: () => void;
  onDelete: () => void;
  portalTarget: HTMLElement | null;
}) {
  const { kind, id, draft } = editor;
  const upd = (patch: Partial<AnySchedule>) =>
    setEditor({ ...editor, draft: { ...draft, ...patch } as AnySchedule });

  const toggleDay = (i: number) => {
    const d = [...(draft.days as boolean[])];
    d[i] = !d[i];
    upd({ days: d as PumpScheduleItem['days'] });
  };

  const sheet = (
    <div onClick={() => setEditor(null)} style={{
      position: 'absolute', inset: 0, zIndex: 100, pointerEvents: 'auto',
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end',
      backdropFilter: 'blur(2px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: 'var(--bg)', borderRadius: '26px 26px 0 0',
        padding: '10px 20px 30px', maxHeight: '88%', overflowY: 'auto',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
      }}>
        <div style={{ width: 38, height: 5, borderRadius: 3, background: 'var(--text3)', margin: '0 auto 14px', opacity: 0.5 }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button onClick={() => setEditor(null)} style={sheetTxtBtn}>Cancel</button>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{id ? 'Edit Schedule' : 'New Schedule'}</span>
          <button onClick={onSave} style={{ ...sheetTxtBtn, color: 'var(--accent)', fontWeight: 700 }}>Save</button>
        </div>

        <div style={{ background: 'var(--card)', borderRadius: 18, padding: '4px 16px', marginBottom: 16, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '0.5px solid var(--sep)' }}>
            <span style={{ fontSize: 16, fontWeight: 560, color: 'var(--text)' }}>Enabled</span>
            <Toggle on={draft.enabled} onChange={(v) => upd({ enabled: v })} size={0.85} />
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

        <div style={{ background: 'var(--card)', borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
              {kind === 'pump' ? 'Pump speed' : 'Target temp'}
            </span>
            <span style={{ fontSize: 17, fontWeight: 720, color: 'var(--accent)' }}>
              {kind === 'pump' ? (draft as PumpScheduleItem).speed + '%' : (draft as HeaterScheduleItem).target + '°'}
            </span>
          </div>
          {kind === 'pump' ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <Slider value={(draft as PumpScheduleItem).speed}
                  onChange={(v) => upd({ speed: v } as Partial<PumpScheduleItem>)}
                  height={42} fill="linear-gradient(90deg,#2bb3a3,#48cbbb)" />
              </div>
              <Presets options={[{ label: 'Low', v: 30 }, { label: 'Medium', v: 65 }, { label: 'High', v: 100 }]}
                value={(draft as PumpScheduleItem).speed}
                onPick={(v) => upd({ speed: v } as Partial<PumpScheduleItem>)} />
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
              <button onClick={() => upd({ target: Math.max(60, (draft as HeaterScheduleItem).target - 1) } as Partial<HeaterScheduleItem>)} style={poolStep}>
                <Icon name="minus" size={20} strokeWidth={2.4} />
              </button>
              <span style={{ fontSize: 38, fontWeight: 730, color: 'var(--text)', letterSpacing: -1, minWidth: 70, textAlign: 'center' }}>
                {(draft as HeaterScheduleItem).target}°
              </span>
              <button onClick={() => upd({ target: Math.min(95, (draft as HeaterScheduleItem).target + 1) } as Partial<HeaterScheduleItem>)} style={poolStep}>
                <Icon name="plus" size={20} strokeWidth={2.4} />
              </button>
            </div>
          )}
        </div>

        <div style={{ background: 'var(--card)', borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 13 }}>Repeat</div>
          <DayChips days={draft.days as boolean[]} onToggle={toggleDay} />
        </div>

        {id && (
          <button onClick={onDelete} style={{
            width: '100%', background: 'var(--card)', border: 'none', cursor: 'pointer',
            boxShadow: 'var(--shadow)', borderRadius: 16, padding: 14,
            color: 'var(--red)', fontSize: 16, fontWeight: 640,
            WebkitTapHighlightColor: 'transparent',
          }}>Delete Schedule</button>
        )}
      </div>
    </div>
  );

  if (!portalTarget) return null;
  return ReactDOM.createPortal(sheet, portalTarget);
}

// ---------------------------------------------------------------------------
// PoolScreen
// ---------------------------------------------------------------------------

export function PoolScreen() {
  const { st, setD, overlayRef, config } = useHC();
  const rawPool = st['pool'] as PoolState | undefined;
  const p: PoolState = {
    ...POOL_DEFAULT,
    ...rawPool,
    // Guard arrays — a null from the state service would crash .map() calls.
    pumpSchedules:   Array.isArray(rawPool?.pumpSchedules)   ? rawPool.pumpSchedules   : POOL_DEFAULT.pumpSchedules,
    heaterSchedules: Array.isArray(rawPool?.heaterSchedules) ? rawPool.heaterSchedules : POOL_DEFAULT.heaterSchedules,
  };
  const setP = (patch: Partial<PoolState>) => setD('pool', patch);
  const [editor, setEditor] = useState<EditorState | null>(null);

  // Variable-based state helpers. All pool data comes from EISY variables, not PG3 device nodes.
  // When the OmniLogic/PG3 adapter is live, poolNodeId will switch back to a PoolNodeState node
  // and the poolNode?.waterTemp branch will take over automatically.
  const varNode  = (id: string | null) => id ? (st[id] as Record<string, unknown> | undefined) : undefined;
  const nodeOn   = (n: Record<string, unknown> | undefined) =>
    (n as { pumpOn?: boolean })?.pumpOn ?? (n as { on?: boolean })?.on;
  const varValue = (id: string | null): number | undefined => {
    const n = varNode(id);
    return (n as { value?: number } | undefined)?.value;
  };

  const poolNode        = varNode(config.poolNodeId);        // WP 622 — eisy0/var/128, {value: °F}
  const chlorinatorNode = varNode(config.poolChlorinatorId); // WP 274 — eisy0/var/69,  {on: bool}
  const heaterNode      = varNode(config.poolHeaterId);      // WP 533 — eisy0/var/5,   {on: bool}
  const pumpNode        = varNode(config.poolPumpNodeId);    // WP 623 — eisy0/var/123, {value: 1=on}

  // Temperature: variable returns {value: N}, future PG3 node returns {waterTemp: N}
  const poolTemp = (poolNode as { waterTemp?: number } | undefined)?.waterTemp
    ?? varValue(config.poolNodeId)
    ?? p.poolTemp;
  const poolTempDisplay = poolTemp > 0 ? `${poolTemp}°` : 'N/A';

  // Chemistry — no live variables yet (future OmniLogic adapter); fall back to pool state defaults.
  const ph           = (poolNode as { ph?: number } | undefined)?.ph        ?? p.ph;
  const orp          = (poolNode as { orp?: number } | undefined)?.orp      ?? p.orpNow;
  const saltLevel    = (poolNode as { saltLevel?: number } | undefined)?.saltLevel     ?? p.saltPPM;
  const saltLevelAvg = (poolNode as { saltLevelAvg?: number } | undefined)?.saltLevelAvg ?? p.saltPPM;

  // Pump: var/123 returns {value: 1} for on; speed comes from a separate var/124.
  const pumpOn    = ((pumpNode as { value?: number } | undefined)?.value ?? 0) > 0
    || (nodeOn(pumpNode) ?? false)
    || p.pumpOn;
  const pumpSpeed = varValue(config.poolPumpSpeedId) ?? p.pumpSpeed;

  // Heater: var/5 returns {on: bool}; setpoint comes from var/126.
  const heaterOn     = nodeOn(heaterNode) ?? p.heaterOn;
  const heaterTarget = varValue(config.poolHeaterSetpointId) ?? p.heaterTarget;

  const salinatorOn = nodeOn(chlorinatorNode) ?? p.chlorinatorOn;

  // Commands — pump on/off to var/123, speed to separate var/124, heater setpoint to var/126.
  const setPump = (on: boolean) =>
    config.poolPumpNodeId    ? setD(config.poolPumpNodeId,    { on })
    : setP({ pumpOn: on });
  const setPumpSpeed = (v: number) => {
    if (config.poolPumpSpeedId) setD(config.poolPumpSpeedId, { value: v } as Record<string, unknown>);
    setP({ pumpSpeed: v });
  };
  const setHeater = (on: boolean) =>
    config.poolHeaterId      ? setD(config.poolHeaterId,      { on }) : setP({ heaterOn: on });
  const setHeaterTarget = (v: number) => {
    if (config.poolHeaterSetpointId) setD(config.poolHeaterSetpointId, { value: v } as Record<string, unknown>);
    setP({ heaterTarget: v });
  };
  const setSalinator = (on: boolean) =>
    config.poolChlorinatorId ? setD(config.poolChlorinatorId, { on }) : setP({ chlorinatorOn: on });

  // Heater running: future PG3 node will provide heaterFiring; infer from on+temp until then.
  const heaterRunning = (poolNode as { heaterFiring?: boolean } | undefined)?.heaterFiring
    ?? (heaterOn && poolTemp > 0 && poolTemp < heaterTarget);
  const phStatus = ph < 7.2 ? 'Low' : ph > 7.8 ? 'High' : 'Ideal';
  const phTint = phStatus === 'Ideal' ? 'var(--green)' : 'var(--red)';

  const schedKey = (k: ScheduleKind) =>
    k === 'pump' ? ('pumpSchedules' as const) : ('heaterSchedules' as const);

  const toggleSched = (kind: ScheduleKind, id: string) => {
    const k = schedKey(kind);
    setP({ [k]: p[k].map(s => s.id === id ? { ...s, enabled: !s.enabled } : s) } as Partial<PoolState>);
  };

  const openAdd = (kind: ScheduleKind) => {
    const draft: AnySchedule = kind === 'pump'
      ? { id: '', enabled: true, start: '08:00', end: '10:00', speed: 65, days: [true,true,true,true,true,true,true] }
      : { id: '', enabled: true, start: '07:00', end: '09:00', target: 84, days: [true,true,true,true,true,true,true] };
    setEditor({ kind, id: null, draft });
  };

  const openEdit = (kind: ScheduleKind, s: AnySchedule) => {
    setEditor({ kind, id: s.id, draft: { ...s, days: [...s.days] as PumpScheduleItem['days'] } });
  };

  const saveSched = () => {
    if (!editor) return;
    const { kind, id, draft } = editor;
    const k = schedKey(kind);
    const list = id
      ? p[k].map(s => s.id === id ? ({ ...draft, id } as typeof s) : s)
      : [...p[k], { ...draft, id: 'sch' + Date.now() } as (typeof p[typeof k])[number]];
    setP({ [k]: list } as Partial<PoolState>);
    setEditor(null);
  };

  const deleteSched = () => {
    if (!editor) return;
    const { kind, id } = editor;
    if (!id) return setEditor(null);
    const k = schedKey(kind);
    setP({ [k]: p[k].filter(s => s.id !== id) } as Partial<PoolState>);
    setEditor(null);
  };

  return (
    <div>
      <LargeTitle title="Pool"
        sub={`${poolTempDisplay} · ${heaterRunning ? 'Heating' : pumpOn ? 'Pump running' : 'Idle'}`} />

      {/* Readings strip */}
      <div style={{ display: 'flex', gap: 11, overflowX: 'auto', paddingBottom: 4,
        margin: '0 calc(-1 * var(--screen-px))', padding: '0 var(--screen-px) 4px',
        scrollbarWidth: 'none' }}>
        <Reading icon="thermo"  label="Pool temp"   value={poolTempDisplay}                    tint="#E07B53" />
        <Reading icon="bolt"    label="Heater"      value={heaterOn ? heaterTarget + '°' : 'Off'} tint="#E0573D"
          status={heaterRunning ? 'Firing' : heaterOn ? 'Idle' : null} />
        <Reading icon="power"   label="Pump"        value={pumpOn ? 'On' : 'Off'}              tint="#2bb3a3"
          status={pumpOn ? 'Running' : null} />
        <Reading icon="droplet" label="pH"          value={Number(ph).toFixed(1)}                      tint={phTint} status={phStatus} />
        <Reading icon="power"   label="ORP"         value={Number(orp) + ' mV'}                        tint="#2bb3a3" />
        <Reading icon="water"   label="Salt"        value={Number(saltLevel).toLocaleString()}          tint="#5a9bd4" />
        <Reading icon="water"   label="Salt avg"    value={Number(saltLevelAvg).toLocaleString()}       tint="#5a9bd4" />
      </div>

      {/* Lighting & Features */}
      <div style={{ marginTop: 22 }}>
        <SectionTitle>Lighting & Features</SectionTitle>
        <div className="hca-tile-grid">
          {config.outdoorsPool.map(o => {
            const s = st[o.id] as OutdoorState | undefined;
            if (!s) return null;
            const isLight = o.name.toLowerCase().includes('light');
            const color = isLight ? 'var(--amber)' : '#2bb3a3';
            return (
              <Tile key={o.id} icon={isLight ? 'bulb' : 'waterfall'} name={o.name}
                status={s.on ? 'On' : 'Off'} active={s.on}
                activeColor={color} glow={isLight}
                onTap={() => setD(o.id, { on: !s.on })}
                control={<Toggle on={s.on} onChange={(v) => setD(o.id, { on: v })} accent="rgba(255,255,255,0.45)" size={0.78} />}
              />
            );
          })}
        </div>
      </div>

      {/* Pump */}
      <div style={{ marginTop: 22 }}>
        <SectionTitle>Pump</SectionTitle>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)' }}>Variable Speed</div>
              <div style={{ fontSize: 13, color: pumpOn ? 'var(--accent)' : 'var(--text2)', fontWeight: 560, marginTop: 1 }}>
                {pumpOn ? `Running · ${pumpSpeed}%` : 'Off'}
              </div>
            </div>
            <Toggle on={pumpOn} onChange={(v) => setPump(v)} size={0.92} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 40, fontWeight: 730, letterSpacing: -1.5, color: pumpOn ? 'var(--text)' : 'var(--text3)' }}>
              {pumpOn ? pumpSpeed : 0}
            </span>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text2)' }}>%</span>
          </div>
          <div style={{ marginBottom: 14, opacity: pumpOn ? 1 : 0.5 }}>
            <Slider value={pumpSpeed} onChange={(v) => setPumpSpeed(v)}
              min={35} max={100}
              height={44} fill="linear-gradient(90deg,#2bb3a3,#48cbbb)" disabled={!pumpOn} />
          </div>
          <Presets options={[{ label: 'Low', v: 35 }, { label: 'Medium', v: 65 }, { label: 'High', v: 100 }]}
            value={pumpSpeed} onPick={(v) => { setPumpSpeed(v); if (!pumpOn) setPump(true); }} />
        </Card>
        <div style={{ height: 14 }} />
        <Schedules kind="pump" list={p.pumpSchedules}
          onEdit={(s) => openEdit('pump', s)} onAdd={() => openAdd('pump')}
          onToggle={(id) => toggleSched('pump', id)} />
      </div>

      {/* Heater */}
      <div style={{ marginTop: 24 }}>
        <SectionTitle>Heater</SectionTitle>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)' }}>Pool Heater</div>
              <div style={{ fontSize: 13, color: heaterRunning ? 'var(--red)' : 'var(--text2)', fontWeight: 560, marginTop: 1 }}>
                {heaterRunning ? 'Firing' : heaterOn ? 'Idle · at temp' : 'Off'}
              </div>
            </div>
            <Toggle on={heaterOn} onChange={(v) => setHeater(v)} size={0.92} accent="#E0573D" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--icon-bg)', borderRadius: 16, padding: '14px 18px' }}>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 560 }}>Current</div>
              <div style={{ fontSize: 26, fontWeight: 720, color: 'var(--text)', letterSpacing: -0.5 }}>{poolTempDisplay}</div>
            </div>
            <Icon name="chevron" size={18} style={{ color: 'var(--text3)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => setHeaterTarget(Math.max(60, heaterTarget - 1))} style={poolStep}>
                <Icon name="minus" size={18} strokeWidth={2.4} />
              </button>
              <div style={{ textAlign: 'center', minWidth: 54 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 560 }}>Target</div>
                <div style={{ fontSize: 26, fontWeight: 720, color: '#E0573D', letterSpacing: -0.5 }}>{heaterTarget}°</div>
              </div>
              <button onClick={() => setHeaterTarget(Math.min(95, heaterTarget + 1))} style={poolStep}>
                <Icon name="plus" size={18} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </Card>
        <div style={{ height: 14 }} />
        <Schedules kind="heater" list={p.heaterSchedules}
          onEdit={(s) => openEdit('heater', s)} onAdd={() => openAdd('heater')}
          onToggle={(id) => toggleSched('heater', id)} />
      </div>

      {/* Water Chemistry */}
      <div style={{ marginTop: 24 }}>
        <SectionTitle>Water Chemistry</SectionTitle>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)' }}>pH Balance</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, marginTop: 1 }}>Current reading</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 30, fontWeight: 730, color: 'var(--text)', letterSpacing: -0.5 }}>{ph.toFixed(1)}</span>
              <span style={{ fontSize: 12.5, fontWeight: 680, color: '#fff', background: phTint, borderRadius: 8, padding: '4px 9px' }}>{phStatus}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 560, color: 'var(--text2)' }}>Target pH</span>
            <span style={{ fontSize: 15, fontWeight: 680, color: 'var(--accent)' }}>{p.phTarget.toFixed(1)}</span>
          </div>
          <Slider value={p.phTarget} onChange={(v) => setP({ phTarget: v })}
            min={7} max={8} step={0.1} height={40} fill="linear-gradient(90deg,#5a9bd4,#48cbbb)" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 12, color: 'var(--text3)', fontWeight: 560 }}>
            <span>7.0</span><span>Ideal 7.4–7.6</span><span>8.0</span>
          </div>
        </Card>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 680, color: 'var(--text)' }}>Chlorinator</div>
              <div style={{ fontSize: 13, color: salinatorOn ? 'var(--green)' : 'var(--text2)', fontWeight: 560, marginTop: 1 }}>
                {salinatorOn ? 'Chlorinating' : 'Off'}
              </div>
            </div>
            <Toggle on={salinatorOn} onChange={(v) => setSalinator(v)} size={0.92} accent="var(--green)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 560, color: 'var(--text2)' }}>ORP set point</span>
            <span style={{ fontSize: 15, fontWeight: 680, color: 'var(--accent)' }}>{p.orpSet} mV</span>
          </div>
          <Slider value={p.orpSet} onChange={(v) => setP({ orpSet: v })}
            min={600} max={800} step={5} height={40} fill="linear-gradient(90deg,#2bb3a3,#48cbbb)" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 12, color: 'var(--text3)', fontWeight: 560 }}>
            <span>600 mV</span><span>Now {orp} mV</span><span>800 mV</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '0.5px solid var(--sep)' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Average salt</span>
            <span style={{ fontSize: 15, fontWeight: 680, color: 'var(--text)' }}>{saltLevelAvg.toLocaleString()} ppm</span>
          </div>
        </Card>
        <div style={{ height: 8 }} />
      </div>

      {editor && (
        <ScheduleEditor
          editor={editor}
          setEditor={(e) => setEditor(e)}
          onSave={saveSched}
          onDelete={deleteSched}
          portalTarget={overlayRef.current}
        />
      )}
    </div>
  );
}
