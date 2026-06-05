/* screens-scenes.jsx — Scenes: per-room automation status + manual overrides.
   Each room runs standard, motion-activated scenes that change through the day.
   Every indicator is tappable so stuck sensors / states can be corrected.
   A per-room slider sets the aggregated scene-light intensity.
   Detailed / Compact view toggle (compact = icon-only control row). */
const { Icon: ICN, Card: ScCard, SectionTitle: ScSectionTitle, Segmented: ScSegmented, Slider: ScSlider, useHC: useHCSc } = window;

// Resolve the human-readable automation status for a room from its live state.
function roomStatus(room, a, scene) {
  if (!a.automated) return { label: 'Automation disabled', tone: 'off',   dot: 'var(--text3)' };
  if (room.hasDoor && !a.doorOpen) return { label: 'Door closed · motion paused', tone: 'door', dot: '#5B7FE0' };
  if (a.manual) return { label: 'Manual switch · resumes when motion stops', tone: 'manual', dot: 'var(--amber)' };
  if (a.motion) return { label: scene + ' · active now', tone: 'active', dot: 'var(--green)' };
  return { label: scene + ' · waiting for motion', tone: 'idle', dot: 'var(--text3)' };
}

// The control set for a room (Door / Night LEDs are conditional).
function roomControls(room, a, motionDisabledByDoor) {
  const c = [
    { key: 'motion', icon: 'motion', label: 'Motion', value: a.motion ? 'Detected' : 'Clear',
      color: '#DD8A0A', on: a.motion, dim: motionDisabledByDoor, patch: { motion: !a.motion } },
  ];
  if (room.hasDoor) c.push({ key: 'doorOpen', icon: 'door', label: 'Door', value: a.doorOpen ? 'Open' : 'Closed',
    color: '#5B7FE0', on: !a.doorOpen, dim: false, patch: { doorOpen: !a.doorOpen } });
  c.push({ key: 'manual', icon: 'power', label: 'Switch', value: a.manual ? 'Manual' : 'Auto',
    color: 'var(--amber)', on: a.manual, dim: false, patch: { manual: !a.manual } });
  if (room.hasNightDim) c.push({ key: 'nightDim', icon: 'moon', label: 'Night LEDs', value: a.nightDim ? 'Dimmed' : 'Normal',
    color: '#7A5AE0', on: a.nightDim, dim: false, patch: { nightDim: !a.nightDim } });
  return c;
}

// Labelled control pill (detailed view).
function StateControl({ icon, label, value, color, on, dim, onTap }) {
  return (
    <button onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
      border: 'none', cursor: 'pointer', borderRadius: 14, padding: '10px 12px',
      background: on ? color + '1f' : 'var(--icon-bg)', opacity: dim ? 0.5 : 1,
      WebkitTapHighlightColor: 'transparent', transition: 'background .18s, opacity .18s',
    }}>
      <span style={{
        width: 34, height: 34, borderRadius: 10, flex: '0 0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: on ? color : 'var(--card)', color: on ? '#fff' : 'var(--text3)',
        boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--sep)', transition: 'all .18s',
      }}>
        <ICN name={icon} size={19} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 11.5, fontWeight: 560, color: 'var(--text2)', letterSpacing: 0.1, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: 14.5, fontWeight: 640, color: on ? color : 'var(--text3)', letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{value}</span>
      </span>
    </button>
  );
}

// Icon-only control button (compact view). title= gives a hover tooltip.
function CompactControl({ icon, color, on, dim, onTap, title }) {
  return (
    <button onClick={onTap} title={title} style={{
      width: 38, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer', flex: '0 0 auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: on ? color : 'var(--icon-bg)', color: on ? '#fff' : 'var(--text3)',
      opacity: dim ? 0.45 : 1, boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--sep)',
      transition: 'all .18s', WebkitTapHighlightColor: 'transparent',
    }}>
      <ICN name={icon} size={19} />
    </button>
  );
}

// Master Auto / Off pill.
function AutoPill({ on, onTap }) {
  return (
    <button onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto',
      border: 'none', cursor: 'pointer', borderRadius: 999, padding: '7px 13px 7px 11px',
      fontSize: 13.5, fontWeight: 640, letterSpacing: -0.2,
      background: on ? 'var(--accent)' : 'var(--icon-bg)', color: on ? '#fff' : 'var(--text2)',
      WebkitTapHighlightColor: 'transparent', transition: 'all .18s',
    }}>
      <ICN name="power" size={15} strokeWidth={2.3} />
      {on ? 'Auto' : 'Off'}
    </button>
  );
}

// Intensity slider row.
function IntensityRow({ value, onChange, compact }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <ScSlider value={value} onChange={onChange} min={0} max={100}
        icon={<ICN name="bulb" size={18} />} fill="var(--accent)" height={compact ? 34 : 38} />
      {!compact && (
        <span style={{ minWidth: 42, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
          fontSize: 15, fontWeight: 640, color: 'var(--text2)', letterSpacing: -0.3 }}>{value}%</span>
      )}
    </div>
  );
}

function RoomScenesScreen() {
  const { st, setD } = useHCSc();
  const tod = (st['_global'] && st['_global'].timeOfDay) || 'Day';
  const view = (st['_global'] && st['_global'].sceneView) || 'detailed';
  const compact = view === 'Compact';

  const set = (id, patch) => setD('auto:' + id, patch);

  const rooms = HC.sceneRooms.map(r => {
    const a = st['auto:' + r.id];
    const scene = HC.sceneSchedules[r.type][tod];
    return { r, a, scene, status: roomStatus(r, a, scene) };
  });

  const needsResume = rooms.filter(x => !x.a.automated || x.a.manual || (x.r.hasDoor && !x.a.doorOpen)).length;
  const resumeAll = () => HC.sceneRooms.forEach(r => set(r.id, { automated: true, manual: false }));

  return (
    <div>
      <LargeTitle title="Scenes" sub="Standard scenes · motion-activated"
        right={needsResume > 0 ? (
          <button onClick={resumeAll} style={{ ...pillBtn, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ICN name="refresh" size={16} strokeWidth={2.2} /> Resume all
          </button>
        ) : null} />

      {/* View toggle */}
      <div style={{ padding: '0 18px 4px' }}>
        <ScSegmented options={['Detailed', 'Compact']} value={view}
          onChange={(v) => setD('_global', { sceneView: v })} />
      </div>

      {/* Room cards */}
      <div style={{ padding: '14px 18px 8px', display: 'flex', flexDirection: 'column', gap: compact ? 10 : 13 }}>
        {rooms.map(({ r, a, scene, status }) => {
          const motionDisabledByDoor = r.hasDoor && !a.doorOpen;
          const controls = roomControls(r, a, motionDisabledByDoor);

          if (compact) {
            return (
              <ScCard key={r.id} pad={false} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 10px' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 5, background: status.dot, flex: '0 0 auto' }} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 640, letterSpacing: -0.3, color: 'var(--text)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                  <AutoPill on={a.automated} onTap={() => set(r.id, { automated: !a.automated })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 13px' }}>
                  <div style={{ flex: 1, opacity: a.automated ? 1 : 0.5 }}>
                    <IntensityRow value={a.intensity} onChange={(v) => set(r.id, { intensity: v })} compact />
                  </div>
                  <div style={{ display: 'flex', gap: 7, flex: '0 0 auto' }}>
                    {controls.map(c => (
                      <CompactControl key={c.key} icon={c.icon} color={c.color} on={c.on}
                        dim={!a.automated || c.dim} title={`${c.label}: ${c.value}`}
                        onTap={() => set(r.id, c.patch)} />
                    ))}
                  </div>
                </div>
              </ScCard>
            );
          }

          return (
            <ScCard key={r.id} pad={false} style={{ overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 15px 12px' }}>
                <span style={{ width: 10, height: 10, borderRadius: 5, background: status.dot, flex: '0 0 auto',
                  boxShadow: status.tone === 'active' ? '0 0 0 4px rgba(52,168,83,0.16)' : 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 650, letterSpacing: -0.3, color: 'var(--text)' }}>{r.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status.label}</div>
                </div>
                <AutoPill on={a.automated} onTap={() => set(r.id, { automated: !a.automated })} />
              </div>

              {/* Scene intensity */}
              <div style={{ padding: '0 15px 13px', opacity: a.automated ? 1 : 0.5 }}>
                <IntensityRow value={a.intensity} onChange={(v) => set(r.id, { intensity: v })} />
              </div>

              {/* Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 12px 13px' }}>
                {controls.map(c => (
                  <StateControl key={c.key} icon={c.icon} label={c.label} value={c.value} color={c.color}
                    on={c.on} dim={!a.automated || c.dim} onTap={() => set(r.id, c.patch)} />
                ))}
              </div>
            </ScCard>
          );
        })}
      </div>
      <div style={{ height: 8 }} />
    </div>
  );
}

Object.assign(window, { RoomScenesScreen });
