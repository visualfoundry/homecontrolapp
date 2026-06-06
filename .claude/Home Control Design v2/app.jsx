/* app.jsx — Home Control shell: theme tokens, store, nav, tab bar, tweaks. */
const { useTweaks, TweaksPanel, TweakSection, TweakSlider, TweakRadio, TweakColor, TweakToggle } = window;
const { IOSDevice } = window;
const { Icon, HCtx } = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "accent": "#E0483D",
  "radius": 22,
  "density": "regular",
  "font": "System",
  "tabs": ["home", "lights", "doors", "climate"]
}/*EDITMODE-END*/;

// Every section the app knows about. The tab bar shows up to 4 of these
// (chosen via Customize); the rest fall through to the More screen.
const SECTIONS = {
  home:       { name: 'Home',       icon: 'home',     tint: '#E0483D' },
  scenes:     { name: 'Scenes',     icon: 'layers',   tint: '#5B7FE0' },
  lights:     { name: 'Lights',     icon: 'bulb',     tint: '#F0A500' },
  doors:      { name: 'Doors',      icon: 'lock',     tint: '#34A853' },
  garage:     { name: 'Garage',     icon: 'garage',   tint: '#5B7FE0' },
  climate:    { name: 'Climate',    icon: 'thermo',   tint: '#E07B53' },
  pool:       { name: 'Pool',       icon: 'pool',     tint: '#2bb3a3' },
  music:      { name: 'Music',      icon: 'speaker',  tint: '#9B5DE5' },
  cinema:     { name: 'Cinema',     icon: 'film',     tint: '#C0455E' },
  fans:       { name: 'Fans',       icon: 'fan',      tint: '#3d9be0' },
  outdoors:   { name: 'Outdoors',   icon: 'pool',     tint: '#2bb3a3' },
  irrigation: { name: 'Irrigation', icon: 'grass',    tint: '#3fa535' },
  leak:       { name: 'Water Leak', icon: 'droplet',  tint: '#5a9bd4' },
  motion:     { name: 'Motion',     icon: 'motion',   tint: '#E0483D' },
  settings:   { name: 'Settings',   icon: 'gear',     tint: '#8a8a8a' },
  docs:       { name: 'Docs',       icon: 'calendar', tint: '#c0793f' },
};
const MAX_TABS = 4;
window.HC_SECTIONS = SECTIONS;

// ── Theme tokens → CSS variables ──
function themeVars(t) {
  const dark = t.dark;
  const pad = { compact: 13, regular: 16, comfy: 20 }[t.density] || 16;
  const font = t.font === 'Rounded'
    ? 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif'
    : '-apple-system, system-ui, "Segoe UI", sans-serif';
  const base = {
    '--accent': t.accent,
    '--radius': t.radius + 'px',
    '--card-pad': pad + 'px',
    '--font': font,
  };
  const light = {
    '--bg': '#EEEDEA', '--card': '#FFFFFF',
    '--text': '#1A1917', '--text2': 'rgba(60,58,54,0.62)', '--text3': 'rgba(60,58,54,0.40)',
    '--sep': 'rgba(60,58,54,0.12)', '--icon-bg': '#F0EFEB',
    '--slider-track': '#E7E6E2', '--switch-off': '#E0DFDB',
    '--seg-bg': '#E8E7E3', '--seg-active': '#FFFFFF',
    '--shadow': '0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.05)',
    '--green': '#34A853', '--amber': '#DD8A0A', '--red': '#E0483D',
  };
  const darkV = {
    '--bg': '#0E0E0D', '--card': '#1B1B19',
    '--text': '#F4F3EF', '--text2': 'rgba(235,235,230,0.62)', '--text3': 'rgba(235,235,230,0.38)',
    '--sep': 'rgba(255,255,255,0.08)', '--icon-bg': '#2A2A27',
    '--slider-track': '#2E2D2A', '--switch-off': '#3A3A36',
    '--seg-bg': '#232320', '--seg-active': '#3C3C38',
    '--shadow': '0 1px 3px rgba(0,0,0,0.4)',
    '--green': '#34D159', '--amber': '#F0A92B', '--red': '#FF5A4D',
  };
  return { ...base, ...(dark ? darkV : light) };
}

const SCREENS = {
  home: 'HomeScreen', lights: 'LightsScreen', doors: 'DoorsScreen', climate: 'ClimateScreen',
  more: 'MoreScreen', music: 'MusicScreen', fans: 'FansScreen', irrigation: 'IrrigationScreen',
  leak: 'LeakScreen', motion: 'MotionScreen', outdoors: 'OutdoorsScreen', cinema: 'CinemaScreen', settings: 'SettingsScreen',
  docs: 'DocsScreen', customize: 'CustomizeScreen', pool: 'PoolScreen', editfav: 'EditFavoritesScreen', editscenes: 'EditScenesScreen',
  scenes: 'RoomScenesScreen', garage: 'GarageScreen',
};

function TabBar({ current, go, dark, tabs }) {
  const items = [...tabs.map(id => ({ id, ...SECTIONS[id] })), { id: 'more', name: 'More', icon: 'grid' }];
  const activeTop = tabs.includes(current) ? current : 'more';
  return (
    <div style={{
      flexShrink: 0, position: 'relative', zIndex: 20,
      paddingBottom: 26, paddingTop: 9, paddingLeft: 6, paddingRight: 6,
      display: 'flex', justifyContent: 'space-around',
      background: dark ? 'rgba(20,20,18,0.82)' : 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderTop: dark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.07)',
    }}>
      {items.map(p => {
        const on = activeTop === p.id;
        return (
          <button key={p.id} onClick={() => go(p.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer', flex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 0',
            color: on ? 'var(--accent)' : 'var(--text3)', WebkitTapHighlightColor: 'transparent',
          }}>
            <Icon name={p.icon} size={24} strokeWidth={on ? 2.1 : 1.8} />
            <span style={{ fontSize: 10.5, fontWeight: on ? 680 : 560, letterSpacing: 0.1 }}>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function App({ t, setTweak }) {
  const [st, setSt] = React.useState(() => JSON.parse(JSON.stringify(HC.initialState)));
  const [stack, setStack] = React.useState(['home']);
  const scrollRef = React.useRef(null);
  const current = stack[stack.length - 1];

  const setD = React.useCallback((id, patch) => {
    setSt(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);
  const overlayRef = React.useRef(null);
  const go = React.useCallback((id) => {
    setStack(prev => {
      if (prev[prev.length - 1] === id) return prev;
      if (id === 'more' || t.tabs.includes(id)) return [id];   // tab slots reset the stack
      return [...prev, id];
    });
  }, [t.tabs]);
  const back = React.useCallback(() => setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev), []);

  React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [current]);
  React.useEffect(() => { window.__hcGo = go; window.__hcTweak = setTweak; window.__hcScroll = scrollRef; }, [go, setTweak]);

  const vars = themeVars(t);
  const ScreenComp = window[SCREENS[current]] || window.HomeScreen;
  const showBack = current !== 'more' && !t.tabs.includes(current);

  return (
    <HCtx.Provider value={{ st, setD, go, back, t, setTweak, sections: SECTIONS, maxTabs: MAX_TABS, overlay: overlayRef }}>
      <div style={{ ...vars, position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', fontFamily: 'var(--font)', color: 'var(--text)' }}>
        {showBack && (
          <button onClick={back} style={{
            position: 'absolute', top: 50, left: 14, zIndex: 40,
            width: 38, height: 38, borderRadius: 19, border: 'none', cursor: 'pointer',
            background: t.dark ? 'rgba(40,40,38,0.7)' : 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)',
            color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)', WebkitTapHighlightColor: 'transparent',
          }}>
            <Icon name="chevron" size={20} strokeWidth={2.4} style={{ transform: 'rotate(180deg)', marginLeft: -2 }} />
          </button>
        )}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: showBack ? 90 : 56, paddingBottom: 24 }}>
          <ScreenComp />
        </div>
        <TabBar current={current} go={go} dark={t.dark} tabs={t.tabs} />
        <div ref={overlayRef} style={{ position: 'absolute', inset: 0, zIndex: 90, pointerEvents: 'none' }} />
      </div>

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak('dark', v)} />
        <TweakColor label="Accent" value={t.accent}
          options={['#E0483D', '#2A6FDB', '#1E9E83', '#E08A1E', '#7A5AE0']}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Layout" />
        <TweakSlider label="Corner radius" value={t.radius} min={10} max={30} unit="px" onChange={(v) => setTweak('radius', v)} />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakRadio label="Font" value={t.font} options={['System', 'Rounded']} onChange={(v) => setTweak('font', v)} />
      </TweaksPanel>
    </HCtx.Provider>
  );
}

// ── Stage: device frame, scaled to fit viewport ──
function Stage() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [scale, setScale] = React.useState(1);
  const W = 402, H = 874;
  React.useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 36) / H, (window.innerWidth - 24) / W));
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: t.dark ? 'radial-gradient(circle at 50% 30%, #28282a, #161617)' : 'radial-gradient(circle at 50% 30%, #e6e5e2, #cfceca)' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        <IOSDevice dark={t.dark} width={W} height={H}>
          <App t={t} setTweak={setTweak} />
        </IOSDevice>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Stage />);
