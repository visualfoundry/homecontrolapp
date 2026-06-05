/* ui.jsx — Home Control design system: icons, store, theme + reusable controls.
   Exports to window. Theme is driven by CSS variables set on the app root. */

// ──────────────────────────────────────────────────────────
// Shared store + nav context
// ──────────────────────────────────────────────────────────
const HCtx = React.createContext(null);
function useHC() { return React.useContext(HCtx); }

// ──────────────────────────────────────────────────────────
// Icon set — clean line icons, currentColor
// ──────────────────────────────────────────────────────────
const ICON_PATHS = {
  home:    <><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10.3V20h12v-9.7" /></>,
  bulb:    <><path d="M9.2 18.2h5.6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-3.8 10.6c.7.6 1 1.2 1.1 2.1h5.4c.1-.9.4-1.5 1.1-2.1A6 6 0 0 0 12 3Z" /></>,
  lock:    <><rect x="5" y="10.5" width="14" height="9.5" rx="2.2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  unlock:  <><rect x="5" y="10.5" width="14" height="9.5" rx="2.2" /><path d="M8 10.5V8a4 4 0 0 1 7.5-1.9" /></>,
  thermo:  <><path d="M12 3.5a2 2 0 0 0-2 2v8.2a4 4 0 1 0 4 0V5.5a2 2 0 0 0-2-2Z" /><path d="M12 9v6.5" strokeWidth="2.6" /></>,
  grid:    <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
  sunrise: <><path d="M12 4v3" /><path d="M5.5 9.5 7 11" /><path d="M18.5 9.5 17 11" /><path d="M3 18h18" /><path d="M6.5 18a5.5 5.5 0 0 1 11 0" /><path d="M2 21h20" /></>,
  moon:    <path d="M20.5 14.2A8 8 0 1 1 10 3.5a6.2 6.2 0 0 0 10.5 10.7Z" />,
  film:    <><rect x="4" y="5" width="16" height="14" rx="2.5" /><path d="M9 5v14M15 5v14M4 9.7h16M4 14.3h16" /></>,
  shades:  <><rect x="4" y="4" width="16" height="16" rx="1.6" /><path d="M4 8.2h16M4 12h16M4 15.8h16" /><path d="M12 20v1.5" /></>,
  dining:  <><path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10" /><path d="M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4m0-9c1.5 0 2.5 2 2.5 5s-1 4-2.5 4m0 0v9" /></>,
  away:    <><path d="M14 4h4a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20h-4" /><path d="M4 12h10M10.5 8l4 4-4 4" /></>,
  sun:     <><circle cx="12" cy="12" r="4.2" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" /></>,
  fan:     <><circle cx="12" cy="12" r="1.7" /><path d="M12 10.3c0-3 .5-6 2.5-6s2.2 3.5.3 5.2M13.5 12.8c2.2 2 4.8 3.5 5.8 1.8s-1-3.8-3.5-4.3M11.4 13.3c-1 2.8-2.6 5.3-4.5 4.3s-1-4 1.4-5" /></>,
  droplet: <path d="M12 3.5s6 6.6 6 10.5a6 6 0 0 1-12 0c0-3.9 6-10.5 6-10.5Z" />,
  motion:  <><circle cx="12" cy="13" r="1.6" fill="currentColor" stroke="none" /><path d="M8.5 9.5a5 5 0 0 0 0 7M15.5 9.5a5 5 0 0 1 0 7M6 7a8.5 8.5 0 0 0 0 12M18 7a8.5 8.5 0 0 1 0 12" /></>,
  speaker: <><rect x="6" y="3" width="12" height="18" rx="3" /><circle cx="12" cy="15" r="3.2" /><circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" /></>,
  volume:  <><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  mute:    <><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5Z" /><path d="m16 9.5 4 5M20 9.5l-4 5" /></>,
  gear:    <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.1a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9h-.1a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3.5v-.1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  shield:  <><path d="M12 3.5 5 6v5.5c0 4.3 3 7.5 7 9 4-1.5 7-4.7 7-9V6Z" /></>,
  door:    <><path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21" /><path d="M4 21h16" /><circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  garage:  <><path d="M4 21V9l8-5 8 5v12" /><path d="M4 21h16" /><path d="M7 21v-8h10v8M7 16h10" /></>,
  grass:   <><path d="M5 21c0-4 1.5-7 3-9M9 21c0-5-.5-9-1-11M12 21c0-4 1-7 2.5-9M15 21c0-5 .5-9 1-11M19 21c-.5-4-2-7-3.5-9" /></>,
  person:  <><circle cx="12" cy="8" r="3.6" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
  battery: <><rect x="3" y="8" width="16" height="9" rx="2" /><path d="M21 11v3" /><rect x="5" y="10" width="3" height="5" rx="0.5" fill="currentColor" stroke="none" /></>,
  search:  <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.5-3.5" /></>,
  power:   <><path d="M12 3v8" /><path d="M7 6.5a7 7 0 1 0 10 0" /></>,
  play:    <path d="M7 5.5v13l11-6.5Z" />,
  pause:   <><rect x="7" y="5" width="3.5" height="14" rx="1" /><rect x="13.5" y="5" width="3.5" height="14" rx="1" /></>,
  next:    <><path d="M6 5.5v13l9-6.5Z" /><path d="M17 5v14" strokeWidth="2.2" /></>,
  prev:    <><path d="M18 5.5v13L9 12Z" /><path d="M7 5v14" strokeWidth="2.2" /></>,
  waterfall: <><path d="M7 3v8M17 3v8" /><path d="M5 11h14" /><path d="M7 14c0 1.5 1 2 1 3.5M12 14c0 1.5 1 2 1 3.5M17 14c0 1.5-1 2-1 3.5" /></>,
  plus:    <><path d="M12 6v12M6 12h12" /></>,
  minus:   <path d="M6 12h12" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  chevDown:<path d="m6 9 6 6 6-6" />,
  check:   <path d="m5 12 5 5 9-11" strokeWidth="2.2" />,
  bell:    <><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z" /><path d="M10.5 20a2 2 0 0 0 3 0" /></>,
  bolt:    <path d="M13 3 5 13h5l-1 8 8-10h-5Z" />,
  water:   <><path d="M4 16c2-1.5 3-1.5 5 0s3 1.5 5 0 3-1.5 5 0" /><path d="M4 11c2-1.5 3-1.5 5 0s3 1.5 5 0 3-1.5 5 0" /></>,
  refresh: <><path d="M4 12a8 8 0 0 1 13.5-5.8L20 8" /><path d="M20 4v4h-4" /><path d="M20 12a8 8 0 0 1-13.5 5.8L4 16" /><path d="M4 20v-4h4" /></>,
  calendar:<><rect x="4" y="5" width="16" height="16" rx="2.5" /><path d="M4 9.5h16M8 3v4M16 3v4" /></>,
  pool:    <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  cloud:   <path d="M7 18.5A4.2 4.2 0 0 1 6.6 10 5.3 5.3 0 0 1 17 8.6 3.7 3.7 0 0 1 16.6 18.5Z" />,
  rain:    <><path d="M7.5 15.5A4 4 0 0 1 7 7.4 5 5 0 0 1 16.8 6 3.5 3.5 0 0 1 16.5 15.5" /><path d="M8 18l-1 2.5M12.5 18l-1 2.5M17 18l-1 2.5" /></>,
  snow:    <><path d="M7.5 14.5A4 4 0 0 1 7 6.4 5 5 0 0 1 16.8 5 3.5 3.5 0 0 1 16.5 14.5" /><path d="M9 18.5h.01M12 20h.01M15 18.5h.01M10.5 21h.01M13.5 21h.01" strokeWidth="2.4" /></>,
  pergola: <><path d="M4 21V8l8-4 8 4v13" /><path d="M4 11h16M4 14.5h16M4 18h16" /></>,
  layers:  <><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 16.5 9 5 9-5" /></>,
};

function Icon({ name, size = 22, strokeWidth = 1.75, style = {}, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}>
      {ICON_PATHS[name] || null}
    </svg>
  );
}

// ──────────────────────────────────────────────────────────
// iOS-style toggle switch
// ──────────────────────────────────────────────────────────
function Toggle({ on, onChange, accent = 'var(--accent)', size = 1 }) {
  const w = 51 * size, h = 31 * size, knob = 27 * size;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange && onChange(!on); }}
      style={{
        width: w, height: h, borderRadius: h, border: 'none', padding: 0,
        cursor: 'pointer', position: 'relative', flexShrink: 0,
        background: on ? accent : 'var(--switch-off)',
        transition: 'background .22s ease', WebkitTapHighlightColor: 'transparent',
      }}>
      <span style={{
        position: 'absolute', top: 2 * size, left: on ? w - knob - 2 * size : 2 * size,
        width: knob, height: knob, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.04)',
        transition: 'left .22s cubic-bezier(.3,1.4,.5,1)',
      }} />
    </button>
  );
}

// ──────────────────────────────────────────────────────────
// Draggable slider (brightness / volume / generic)
// ──────────────────────────────────────────────────────────
function Slider({ value, onChange, min = 0, max = 100, step = 1, fill = 'var(--accent)',
                  track = 'var(--slider-track)', height = 38, icon, disabled }) {
  const ref = React.useRef(null);
  const decimals = (String(step).split('.')[1] || '').length;
  const set = React.useCallback((clientX) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    let p = (clientX - r.left) / r.width;
    p = Math.max(0, Math.min(1, p));
    const raw = min + p * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange && onChange(Number(snapped.toFixed(decimals)));
  }, [onChange, min, max, step, decimals]);
  const down = (e) => {
    if (disabled) return;
    e.preventDefault(); e.stopPropagation();
    set(e.clientX);
    const move = (ev) => set(ev.clientX);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div ref={ref} onPointerDown={down} style={{
      position: 'relative', height, borderRadius: height / 2.6, cursor: disabled ? 'default' : 'pointer',
      background: track, overflow: 'hidden', flex: 1, touchAction: 'none',
      opacity: disabled ? 0.5 : 1, userSelect: 'none',
    }}>
      <div style={{ position: 'absolute', inset: 0, width: pct + '%', background: fill, transition: 'width .08s linear' }} />
      {icon && (
        <div style={{ position: 'absolute', left: 13, top: 0, bottom: 0, display: 'flex', alignItems: 'center',
          color: pct > 14 ? 'rgba(255,255,255,0.95)' : 'var(--text3)', zIndex: 1, pointerEvents: 'none' }}>
          {icon}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Building blocks
// ──────────────────────────────────────────────────────────
function Card({ children, style = {}, onClick, pad = true }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--card)', borderRadius: 'var(--radius)',
      padding: pad ? 'var(--card-pad)' : 0, boxShadow: 'var(--shadow)',
      ...style,
    }}>{children}</div>
  );
}

function SectionTitle({ children, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      margin: '0 4px 10px', padding: '0 2px' }}>
      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 680, letterSpacing: -0.4, color: 'var(--text)' }}>{children}</h3>
      {action && <button onClick={onAction} style={{ background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--accent)', fontSize: 15, fontWeight: 600, padding: 0 }}>{action}</button>}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', background: 'var(--seg-bg)', borderRadius: 12, padding: 3, gap: 2 }}>
      {options.map(o => {
        const active = o === value;
        return (
          <button key={o} onClick={() => onChange(o)} style={{
            flex: 1, border: 'none', cursor: 'pointer', borderRadius: 9, padding: '7px 4px',
            fontSize: 14, fontWeight: active ? 640 : 520, letterSpacing: -0.2,
            color: active ? 'var(--text)' : 'var(--text2)',
            background: active ? 'var(--seg-active)' : 'transparent',
            boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            transition: 'all .18s ease', WebkitTapHighlightColor: 'transparent',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

function Avatar({ name, present, size = 46 }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hues = { A: 28, G: 200, J: 330, L: 150, P: 265, V: 45 };
  const hue = hues[initials[0]] ?? 220;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 640, color: present ? '#fff' : 'var(--text3)',
        background: present ? `oklch(0.62 0.13 ${hue})` : 'var(--switch-off)',
        opacity: present ? 1 : 0.7,
      }}>{initials}</div>
      <span style={{
        position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: '50%',
        background: present ? 'var(--green)' : 'var(--text3)', border: '2.5px solid var(--card)',
      }} />
    </div>
  );
}

Object.assign(window, {
  HCtx, useHC, Icon, Toggle, Slider, Card, SectionTitle, Segmented, Avatar,
});
