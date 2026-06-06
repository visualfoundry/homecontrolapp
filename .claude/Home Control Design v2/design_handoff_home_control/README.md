# Handoff: Home Control — Mobile PWA Redesign

## Overview
A ground-up mobile redesign of an existing WordPress home-automation control panel, intended to ship as a **mobile-first PWA (WordPress)**. It replaces a cramped desktop top-nav and skeuomorphic clip-art with a clean, iOS-Home-inspired (but original) app: a bottom tab bar, a dashboard hub, and dedicated screens for every device domain. Light **and** dark themes are first-class. Most icons/tiles are actionable and, in production, map to the site's existing device-control API.

## About the Design Files
The files in this bundle are **design references created in HTML/React (via Babel-in-browser)** — interactive prototypes that demonstrate the intended look, layout, and behavior. **They are not production code to copy verbatim.** The task is to **recreate these designs in the target environment** using its established patterns and component library. For a WordPress PWA this likely means a React/Preact front end (or the theme's existing stack) talking to the current control API. If no front-end framework is established yet, pick the most appropriate one for a PWA and implement there.

Device data in `data.js` is **seeded mock state** (real room/family names from the client's site, representative values). Replace it with live API reads/writes. All toggles/sliders currently mutate in-memory React state only.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, and interactions are all specified here and in the prototype. Recreate pixel-faithfully using the codebase's libraries; values below are authoritative.

---

## Architecture of the Prototype
- `Home Control App.html` — entry point. Loads React 18.3.1 (UMD) + Babel standalone, then the scripts below in order. Contains global CSS resets and `@keyframes` (`spin`, `rainfall`, `snowfall`).
- `data.js` — plain JS. Builds `window.HC` (device lists, people, scenes) and `window.HC.initialState` (flat `{ id: {…state} }` map). Pure data; no UI.
- `ios-frame.jsx` — device bezel/status-bar/home-indicator wrapper (`IOSDevice`). Cosmetic; **not needed** in a real app — the design IS the app inside it.
- `tweaks-panel.jsx` — design-time control panel (theme/accent/radius/density/font). A prototyping affordance — **not a production feature**, though the underlying theme tokens are real.
- `ui.jsx` — design system: `Icon` (line-icon set), `Toggle`, `Slider`, `Card`, `SectionTitle`, `Segmented`, `Avatar`, plus the `HCtx` React context + `useHC()` store hook.
- `screens-main.jsx` — `HomeScreen`, `LightsScreen`, `DoorsScreen`, `ClimateScreen`, `EditFavoritesScreen`, `EditScenesScreen`, shared `LargeTitle`/`Tile`/`StatTile`, and button styles.
- `screens-scenes.jsx` — `RoomScenesScreen` (per-room automation/scene status with manual overrides) + its `StateControl` pill. Loads after `screens-main.jsx` (reuses `LargeTitle`/`StatTile`/`pillBtn`).
- `screens-more.jsx` — `MusicScreen`, `FansScreen`, `IrrigationScreen`, `LeakScreen`, `MotionScreen`, `OutdoorsScreen`, `SettingsScreen`, `MoreScreen`, `CustomizeScreen`, `DocsScreen`.
- `screens-pool.jsx` — `PoolScreen` + `ScheduleEditor` (bottom-sheet, rendered via portal into an overlay host).
- `app.jsx` — shell: theme→CSS-variable mapping, the store (`useState` + `setD(id, patch)`), nav stack, `TabBar`, section registry (`SECTIONS`), screen map (`SCREENS`), and the `Stage`/`IOSDevice` mount.

### Store / state model (important)
A single flat object keyed by device id. `setD(id, patch)` shallow-merges a patch into one device. `useHC()` exposes `{ st, setD, go, back, t, setTweak, sections, maxTabs, overlay }`.
- `go(id)` navigates; tab-bar destinations reset the nav stack, secondary screens push onto it (enables the back chevron).
- Devices that appear on multiple screens (e.g. Pool Light, Waterfall) share one id, so toggling anywhere stays in sync. **Preserve this single-source-of-truth behavior against the real API.**
- A few **non-device state keys** also live in `st`: `_global` (time-of-day, weather, holiday/security flags), `_favs.ids` (the ordered Home favorites list), `_scenes.ids` (the ordered Home scenes list), `person:<id>` (each household member's `{ home }` presence), and `auto:<roomId>` (per-room automation: `{ automated, motion, doorOpen, manual, nightDim, intensity }`). Plus the UI prefs `_global.timeOfDay`, `_global.weather`, `_global.sceneView`. In production these map to user/UI preferences, presence detection, and the automation engine — not the device-control API.
- **Routing**: `app.jsx` has `SECTIONS` (tab-able domains, each `{ name, icon, tint }` — includes the optional `scenes` panel) and `SCREENS` (every route id → screen component name, including `scenes → RoomScenesScreen` and secondary screens like `editfav → EditFavoritesScreen`, `editscenes → EditScenesScreen`, `customize`, `docs`). Tab destinations reset the stack; everything else pushes.

---

## Standing It Up (Setup & Build)
The prototype runs entirely in the browser (React 18 UMD + Babel-in-browser, no build step). **Do not ship it that way** — Babel-in-browser is for prototyping only. Stand up a real app instead:

### Recommended scaffold (framework-agnostic default: Vite + React + TS)
If the target codebase already has a front-end stack (WordPress theme React/Preact, Next.js, etc.), use **that** and skip this. Otherwise:

```bash
npm create vite@latest home-control -- --template react-ts
cd home-control
npm install
# (optional) icon lib if you don't want to hand-port the SVG set:
#   npm install lucide-react
npm run dev
```

### Suggested file layout
```
src/
  styles/
    reset.css         # global reset + scrollbar hiding + button font
    tokens.css        # :root design tokens + [data-theme="dark"] overrides
    keyframes.css     # spin / rainfall / snowfall
  lib/
    store.tsx         # HCtx context + useHC() + setD() (port app.jsx store)
    data.ts           # device model + initialState + favCatalog (port data.js)
  components/         # Icon, Toggle, Slider, Card, SectionTitle, Segmented, Tile, Avatar (port ui.jsx)
  screens/           # HomeScreen, LightsScreen, … EditFavoritesScreen (port screens-*.jsx)
  App.tsx            # shell: theme application, TabBar, nav stack
  main.tsx
```

### Port order (each step independently testable)
1. **Styles** — drop in `reset.css`, `tokens.css`, `keyframes.css` (see *CSS Strategy* below). Import them once in `main.tsx`.
2. **Data** — port `data.js` to `data.ts` (it's pure JS; mostly add types). Keep `initialState`, `favCatalog`, the `_favs`/`person:`/`_global` keys.
3. **Store** — port the `useState` + `setD(id, patch)` store and `HCtx`/`useHC()` from `app.jsx`. In production, swap the seed `initialState` for API reads and route `setD` writes through the control API (optimistic + reconcile).
4. **Primitives** — port `ui.jsx` components. Replace inline `style={{…}}` objects with CSS classes / CSS Modules that reference the tokens (see below).
5. **Shell** — TabBar + nav stack + Customize + persistence (`tabs: string[]`, theme, accent → localStorage or user prefs).
6. **Screens** — Home → Lights → Doors → Climate → Pool → the rest. Then schedules, weather animations.

### Theme application (replaces `themeVars()`)
The prototype injects tokens as inline CSS variables on a wrapper. In production, set tokens in stylesheets and just **toggle an attribute** on the root:
```ts
document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
// dynamic per-user values (chosen accent / radius / density) stay inline vars:
document.documentElement.style.setProperty('--accent', accent);
document.documentElement.style.setProperty('--radius', radius + 'px');
document.documentElement.style.setProperty('--card-pad', pad + 'px');
```

---

## CSS Strategy & Stylesheet
The prototype is **CSS-in-JS via inline `style` objects keyed off CSS custom properties**. For production, keep the **CSS-variable token system** (it's the source of truth for theming and is already clean), but move the per-element styling out of inline objects into **plain CSS or CSS Modules**. Tailwind is fine too — map the tokens to your `theme.extend`. The three stylesheets below are ready to paste.

### `tokens.css`
Light tokens live on `:root`; dark is a single attribute override. Per-user values (`--accent`, `--radius`, `--card-pad`, `--font`) have defaults here and can be overridden inline at runtime.
```css
:root {
  /* user-tunable (defaults; may be overridden inline per user) */
  --accent: #E0483D;          /* alts: #2A6FDB #1E9E83 #E08A1E #7A5AE0 */
  --radius: 22px;             /* range 10–30 */
  --card-pad: 16px;           /* compact 13 / regular 16 / comfy 20 */
  --font: -apple-system, system-ui, "Segoe UI", sans-serif; /* Rounded: ui-rounded, "SF Pro Rounded", … */

  /* light theme */
  --bg: #EEEDEA;
  --card: #FFFFFF;
  --text: #1A1917;
  --text2: rgba(60,58,54,0.62);
  --text3: rgba(60,58,54,0.40);
  --sep: rgba(60,58,54,0.12);
  --icon-bg: #F0EFEB;
  --slider-track: #E7E6E2;
  --switch-off: #E0DFDB;
  --seg-bg: #E8E7E3;
  --seg-active: #FFFFFF;
  --shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.05);
  --green: #34A853;
  --amber: #DD8A0A;
  --red: #E0483D;
}

[data-theme="dark"] {
  --bg: #0E0E0D;
  --card: #1B1B19;
  --text: #F4F3EF;
  --text2: rgba(235,235,230,0.62);
  --text3: rgba(235,235,230,0.38);
  --sep: rgba(255,255,255,0.08);
  --icon-bg: #2A2A27;
  --slider-track: #2E2D2A;
  --switch-off: #3A3A36;
  --seg-bg: #232320;
  --seg-active: #3C3C38;
  --shadow: 0 1px 3px rgba(0,0,0,0.4);
  --green: #34D159;
  --amber: #F0A92B;
  --red: #FF5A4D;
}
```

### `reset.css`
```css
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { height: 100%; background: var(--bg); overscroll-behavior: none; }
body { font-family: var(--font); color: var(--text); }
#root { height: 100%; }
#root ::-webkit-scrollbar { width: 0; height: 0; display: none; }   /* design hides scrollbars */
button { font-family: inherit; }
```

### `keyframes.css`
```css
@keyframes spin { to { transform: rotate(360deg); } }                                 /* fan icons; duration = 1.4 - speed*0.3s */
@keyframes rainfall { from { transform: translateY(-14px); opacity: 0; } 12% { opacity: 1; } to { transform: translateY(168px); opacity: .9; } }
@keyframes snowfall { from { transform: translateY(-14px) translateX(0); opacity: 0; } 14% { opacity: 1; } to { transform: translateY(168px) translateX(14px); opacity: .9; } }
```

### Translating inline styles → CSS classes (example)
Inline objects map 1:1 to declarations. e.g. the `Card` style in `ui.jsx` becomes:
```css
.card {
  background: var(--card);
  border-radius: var(--radius);
  padding: var(--card-pad);
  box-shadow: var(--shadow);
}
```
…and a `Tile`'s active state (currently a JS conditional swapping bg/text to the device tint) becomes a modifier class:
```css
.tile.is-active { background: var(--tile-tint); color: #fff; }
```
where `--tile-tint` is set per-tile (inline or via a data attribute) from the section/device tint table. **Rule of thumb:** anything that's a fixed visual constant → CSS class; anything truly dynamic per instance (a tile's tint, a slider's fill %, a fan's animation duration) → an inline CSS variable consumed by the class. Keep all transitions/easings from the *Shadows / motion* token list.

---

## Navigation
- **Bottom tab bar**, frosted/blurred, safe-area bottom padding. Up to **4 user-chosen section shortcuts + a pinned "More"** (5 slots total).
- Active tab: accent color, icon stroke 2.1, label weight 680. Inactive: `--text3`, stroke 1.8.
- **Customize** screen (More → Edit): reorder shortcuts (▲▼), remove (−) to More, add (+) from More up to the max of 4. "More" is always last and pinned. Selection persists (in the prototype, via the tweaks store; in production, persist per-user, e.g. localStorage or user prefs).
- Secondary screens (not on the bar) show a back chevron top-left (absolute, 38×38 circle, blurred translucent bg).

## Section Registry
`home, lights, doors, climate, pool, music, fans, outdoors, irrigation, leak, motion, settings, docs`. Each has `{ name, icon, tint }`. Default tab bar: `home, lights, doors, climate` (+ More).

---

## Screens / Views

### Home (Dashboard)
Section order top→bottom: **LargeTitle → Weather/House tile → Status → Scenes → Favorites → Who's Home.**
- **LargeTitle** "Good morning" + sub "The House · All quiet"; right-side gear button → Settings.
- **Weather / House tile**: rounded card, full-bleed sky gradient that changes by **time of day** (Morning/Day/Evening/Night, chosen via an inset `Segmented`) **and by condition** (Clear/Cloudy/Rain/Snow). Shows label "The House", large temperature (300 weight, −2 letter-spacing), and "H:/L:" line. A 56×56 translucent button holds the condition icon; tapping it cycles conditions (in production, drive from the weather feed). Rain renders ~22 animated streaks (`rainfall`), Snow ~16 animated dots (`snowfall`). Text turns white on Night/Rain.
- **Status** row (horizontal scroll of `StatTile`, 128px min-width): Avg. indoor (→Climate), Pool temp (→Pool), Lights on (→Lights), Doors locked (→Doors), Motion alerts (→Motion), Home (people count). Each: tinted 30×30 icon chip, big value (weight 720), label. Values are computed live from `st`.
- **Scenes** row (horizontal scroll): a **user-editable** set of scene chips (104px: icon in a tinted rounded square, label). Tap a chip toggles a local active highlight (fills with the scene tint). The shown set + order is stored in `st['_scenes'].ids`; chips render by looking each id up in `HC.scenes`. The "Edit" action navigates to the **Edit Scenes** screen (route `editscenes`). Empty state shows an "Add scenes" card. `HC.scenes` is the full catalog (11 scenes: Good Morning, Away, Movie Night, Dinner, Goodnight, Welcome Home, Relax, Focus, Party, Reading, Lock Down); `sceneDefault` is the 5 shown initially.
- **Favorites** (2-col grid of `Tile`): a **user-editable** set of pinned device shortcuts. Defaults: Living Room (light), Front Door (lock), Kitchen (light), Music, Garden Lights, Living Room Fan. The "Edit" action navigates to the **Edit Favorites** screen (route `editfav`). The pinned set + order is stored in state as `st['_favs'].ids` (an array of device ids); tiles render by looking each id up in `HC.favCatalog`. Empty state shows an "Add favorites" card.
- **Who's Home**: card with a horizontal `Avatar` strip; **each person is a tappable button that toggles present/away** (`setD('person:'+id, { home })`). Present people are colored with a green status dot; away are greyed. The Home stat tile "Home" count derives from this state live.

### Scenes (route `scenes`, optional tab-able section)
- **Optional panel** — registered in `SECTIONS` so it shows on the **More** screen and can be added to the tab bar via Customize; not a default tab. Icon `layers`, tint `#5B7FE0`.
- **Purpose**: per-room *automation* status. Distinct from the Home dashboard scene chips (quick presets). Each room runs **standard, motion-activated scenes that change through the day**; this screen shows each room's live state and lets you correct stuck indicators by hand.
- **Header**: `LargeTitle` "Scenes" + sub; a **Resume all** pill (top-right, shown only when any room has an override or is disabled) re-enables automation + clears manual overrides for every room. A **Detailed / Compact** `Segmented` (persisted to `st['_global'].sceneView`) switches the room-card layout.
- **Room cards** (`HC.sceneRooms`): header = status dot + room name + (Detailed only: plain-language status line) + a master **Auto/Off** pill (`power` icon) toggling `automated`. Each card has a **scene-intensity `Slider`** (`st['auto:'+id].intensity`, 0–100) that sets the room's aggregated scene-light brightness (dims when automation is off). Below, the control set — each reads/writes one boolean on `st['auto:'+roomId]`:
  - **Detailed view**: a 2-col grid of labelled **`StateControl`** pills (icon + name + colored status word).
  - **Compact view**: the same controls as an icon-only **`CompactControl`** row beside the slider; the status word/label is dropped (shown as a hover `title` tooltip).
  - **Motion** (`motion`): Detected/Clear, amber when active. Dimmed when automation off or door-closed (door disables motion). Tap to clear a stuck sensor.
  - **Door** (`doorOpen`, rooms with `hasDoor`): Open/Closed, blue when closed. Closed → scene changes + motion paused. Tap to correct a stuck indicator.
  - **Switch** (`manual`): Auto/Manual, amber when manual. Represents someone pressing a physical switch — automation pauses until motion stops. Tap to clear.
  - **Night LEDs** (`nightDim`, rooms with `hasNightDim` — bedrooms/baths): Normal/Dimmed, purple when dimmed. Auto at night; tap to override.
- **Status derivation** (`roomStatus()`, Detailed view): priority order disabled → door-closed → manual → motion-active → idle. Scene names come from `HC.sceneSchedules[type][timeOfDay]` (time-of-day is driven by `st['_global'].timeOfDay`, set on the Home weather tile — there is no in-screen time picker). **In production**: `automated`/`manual`/`nightDim`/`intensity` are automation-engine state; `motion`/`doorOpen` mirror sensor feeds (the manual toggles are write-throughs that force/clear the sensor or override).

### Edit Scenes (route `editscenes`, secondary screen)
- Reached via Home → Scenes → **Edit**. Same pattern as Edit Favorites: `LargeTitle` "Scenes" + sub "Pinned to your Home dashboard"; **Done** pill (top-right) calls `back()`.
- **On Home · n** section: a `Card` list of the currently shown scenes in order. Each row: a **red minus circle** (remove), a 30px **tint-colored** scene-icon chip (`tint + '1f'` bg, tint fg), the name, and **up/down chevron reorder buttons**. Reordering swaps adjacent ids in `st['_scenes'].ids`.
- **Add a Scene** section: a single `Card` listing the catalog scenes **not already shown**, each with a **green plus circle** to add. Hidden when nothing is left to add.

### Edit Favorites (route `editfav`, secondary screen)
- Reached via Home → Favorites → **Edit**. `LargeTitle` "Favorites" + sub "Pinned to your Home dashboard"; a **Done** pill (top-right) calls `back()`.
- **On Home · n** section: a `Card` list of the currently pinned favorites in order. Each row: a **red minus circle** (26px) to remove, a 30px icon chip, the label, and **up/down chevron reorder buttons** (32px, `--icon-bg`; disabled+dimmed at the ends). Reordering swaps adjacent ids in `st['_favs'].ids`.
- **Per-category add sections** (Lights / Doors / Music / Fans / Outdoor): each `Card` lists the catalog items in that group **not already pinned**, each with a **green plus circle** to add (appends to the ids array). Groups with nothing left to add are hidden.
- Backed by `HC.favCatalog`: an array of `{ group, items: [{ id, icon, label }] }`. The `id` must match a device id in `initialState` (the tile reads/writes that device's live state). In production, source this catalog from the device registry rather than hard-coding it.

### Lights
- LargeTitle with "X on across the house"; "All Off" pill when any on.
- `Segmented`: All Lights / On Now (filter).
- Per **room** card: header (room name, "n of m on", master `Toggle` in amber). Each light is a **LightBar**: a full-width 54px draggable brightness slider (warm gradient `#f5b942→#ffd86b`), bulb icon (tap = on/off), name, and "%/Off" label. Dragging sets level (and turns on when >0).

### Doors
- LargeTitle "X of Y exterior doors locked"; "Lock All" pill.
- **Exterior** (2-col `Tile` grid): locked = green + lock icon; unlocked = red + unlock icon; tile toggles lock; toggle control in corner.
- **Interior · Sensors** (list card): door icon (amber when open), name, optional low-battery icon, Open/Closed status (amber/green).

### Climate
- LargeTitle "4 zones · Auto"; `Segmented`: Home / Away / Sleep.
- 2-col grid of zone cards, each with a **circular thermostat dial** (SVG, 132px, 270° arc): track + colored progress (cool `#3d9be0` / heat `#e0573d` / auto `#E0883D`), center temp (weight 700) + mode label. Below: −/+ step buttons (0.5° increments) and the "lo°–hi°" range.

### Pool (order top→bottom)
1. **Readings** strip (horizontal `Reading` tiles): Pool temp, Heater (target° + Running/Idle/Off status), pH (value + Ideal/High/Low), Salt (k ppm), ORP now (mV).
2. **Lighting & Features** (2-col `Tile`): Pool Light, Waterfall Light (both amber + glow when on), Waterfall (teal). *(Water Feature was intentionally removed.)*
3. **Pump**: card with on/off toggle + status; big % readout; 44px drag slider (teal gradient `#2bb3a3→#48cbbb`) for exact speed 0–100; Low/Medium/High preset buttons (30/65/100). Then **Schedules** list + "Add Schedule".
4. **Heater**: on/off (red accent) + live status (Running when poolTemp < target); current-temp vs adjustable target (−/+ , 60–95°). Then its own **Schedules** (target temp instead of speed).
5. **Water Chemistry**:
   - **pH**: current reading + Ideal/High/Low badge; target slider **7.0–8.0, step 0.1** (ideal band 7.4–7.6 labeled).
   - **Chlorinator**: on/off (green) + status; **ORP set-point slider 600–800 mV, step 5** (default 715, live reading shown); average salt in ppm.
- **ScheduleEditor** (bottom sheet via portal): Enabled toggle; Start/End `<input type="time">`; pump = speed slider + Low/Med/High presets, heater = target −/+; **Repeat** day-of-week chips; Delete (when editing). Schedules are an array per device; add/edit/delete supported. `daysSummary()` renders "Every day / Weekdays / Weekends / explicit list".

### Music
- "Now Playing" gradient card (artwork chip, title/zone, prev/play-pause/next). Per-speaker list: name + on/off toggle + volume slider (disabled when off) + value. Zones: Dining, Kitchen, Library, Living Room, Pergola.

### Fans
- 2-col cards: spinning fan icon (CSS `spin`, speed scales duration) when on; on/off toggle; Off/Low/Med/High segmented speed.

### Irrigation
- Programs (toggle list); **Schedule** weekly grid (times × days with grass glyphs); Schedule On / Skip Today toggles; **Zones** list with per-zone minutes + "Run".

### Leak
- Green "No leaks detected" banner (or red if wet); sensor list with droplet icon and Dry/Leak! status.

### Motion
- "Motion detected" accent banner listing active rooms; sensor list with low-battery flag and a status dot (red + glow when active).

### Outdoors
- **Pool** (2-col `Tile`): Light, Waterfall, Pool (light), and **Doors Auto Lock** (green + lock icon when on; toggles backyard doors auto-lock — shares id `ob-autolock`).
- **Backyard**: Pergola Light (toggle + brightness slider), Pergola Fan, Garden Lights, Water Feature.

### Settings
- **Appearance**: Dark Mode toggle (drives the theme). Then Security, Environment, Schedules — each a labeled toggle list (real device/automation names).

### More / Customize / Docs
- **More**: 2-col grid of whatever sections aren't on the tab bar; "Edit" + "Customize Tab Bar" entry.
- **Customize**: described under Navigation.
- **Docs**: General Documents + Family Only lists (chevron rows).

---

## Interactions & Behavior
- **Toggles**: iOS switch, 51×31 (×size), knob 27, spring ease `cubic-bezier(.3,1.4,.5,1)`, bg transition .22s. `stopPropagation` so toggling inside a tappable tile doesn't also fire the tile.
- **Sliders**: pointer-drag (pointerdown on track + window pointermove/up), value snapped to `step`, clamped. Support decimals (pH .1, ORP 5). Fill width transitions .08s.
- **Tiles**: whole tile is tappable (primary action) with a corner toggle mirroring state; active state swaps bg to the device tint, text/icon to white, optional radial "glow".
- **Nav**: tab → reset stack; secondary → push (back chevron). Scroll resets to top on screen change.
- **Bottom sheet** (ScheduleEditor): tap-scrim to dismiss; rendered through a portal into an absolute overlay at the app root (`zIndex 100`) so it covers the device regardless of scroll.
- **Fan**: icon rotation animated, duration `1.4 - speed*0.3`s.
- **Weather**: condition cycle on icon tap; rain/snow particle overlays.

## State Management
- Flat `st` keyed by device id; `setD(id, patch)` merges. Derived counts (lights on, doors locked, avg temp, etc.) computed at render from `st`.
- Theme/tweak state separate (`t`, `setTweak`) — in production reduce to: `theme: 'light'|'dark'`, accent, optional density/radius/font, and the persisted **tab-bar layout** (`tabs: string[]`).
- Per-device schedules live on the device object as arrays (`pumpSchedules`, `heaterSchedules`), items `{ id, enabled, start, end, speed|target, days[7] }`.
- **Production**: replace seed state with API reads; route `setD` writes to the control API (optimistic update + reconcile). Keep shared ids so cross-screen state stays consistent.

---

## Design Tokens

### Colors — Light
| Token | Value |
|---|---|
| `--bg` | `#EEEDEA` |
| `--card` | `#FFFFFF` |
| `--text` | `#1A1917` |
| `--text2` | `rgba(60,58,54,0.62)` |
| `--text3` | `rgba(60,58,54,0.40)` |
| `--sep` | `rgba(60,58,54,0.12)` |
| `--icon-bg` | `#F0EFEB` |
| `--slider-track` | `#E7E6E2` |
| `--switch-off` | `#E0DFDB` |
| `--seg-bg` | `#E8E7E3` |
| `--seg-active` | `#FFFFFF` |
| `--shadow` | `0 1px 2px rgba(0,0,0,.04), 0 4px 14px rgba(0,0,0,.05)` |
| `--green` | `#34A853` |
| `--amber` | `#DD8A0A` |
| `--red` | `#E0483D` |

### Colors — Dark
| Token | Value |
|---|---|
| `--bg` | `#0E0E0D` |
| `--card` | `#1B1B19` |
| `--text` | `#F4F3EF` |
| `--text2` | `rgba(235,235,230,0.62)` |
| `--text3` | `rgba(235,235,230,0.38)` |
| `--sep` | `rgba(255,255,255,0.08)` |
| `--icon-bg` | `#2A2A27` |
| `--slider-track` | `#2E2D2A` |
| `--switch-off` | `#3A3A36` |
| `--seg-bg` | `#232320` |
| `--seg-active` | `#3C3C38` |
| `--shadow` | `0 1px 3px rgba(0,0,0,.4)` |
| `--green` | `#34D159` |
| `--amber` | `#F0A92B` |
| `--red` | `#FF5A4D` |

### Accent & feature tints
- Default accent `--accent`: `#E0483D` (red, kept from the legacy brand). Alt options offered: `#2A6FDB`, `#1E9E83`, `#E08A1E`, `#7A5AE0`.
- Section tints: home `#E0483D`, lights `#F0A500`, doors `#34A853`, climate `#E07B53`, pool `#2bb3a3`, music `#9B5DE5`, fans `#3d9be0`, outdoors `#2bb3a3`, irrigation `#3fa535`, leak `#5a9bd4`, motion `#E0483D`, settings `#8a8a8a`, docs `#c0793f`.
- Brightness gradient `#f5b942→#ffd86b`; pump/teal gradient `#2bb3a3→#48cbbb`.

### Radius / spacing / type
- `--radius`: default **22px** (range 10–30). Smaller chips/inputs use 9–18px.
- `--card-pad`: compact 13 / regular 16 / comfy 20.
- Screen horizontal padding: **18px**. Grid/tile gap: **12px**. Section gap: ~22px.
- Font: system stack (`-apple-system, system-ui, "Segoe UI", sans-serif`); "Rounded" option = `ui-rounded`. **No webfont dependency.**
- Type scale (px / weight): LargeTitle 33/720 (−0.9 ls); SectionTitle 20/680; tile title 15.5/640; body row 16/520–560; secondary 12.5–14/500–600; big numerics 26–46/720–300.
- Tab bar: icon 24, label 10.5, weight 560/680.
- Min tap target ~44px; toggles/step buttons 34–40px.

### Shadows / motion
- Card shadow per theme (above). Bottom sheet `0 -8px 40px rgba(0,0,0,.3)`.
- Toggle knob spring `cubic-bezier(.3,1.4,.5,1)`; switch bg .22s; slider fill .08s; tile bg .2s.
- Keyframes: `spin` (fans), `rainfall`, `snowfall` (weather).

## Assets
- **No raster assets / no external image files.** All iconography is an inline SVG line-icon set defined in `ui.jsx` (`ICON_PATHS`), drawn at 24×24 with `currentColor`. Recreate with the codebase's icon system (e.g. an existing SVG sprite or an icon lib with matching glyphs) — names used: home, bulb, lock/unlock, thermo, grid, sunrise, moon, film, dining, away, sun, fan, droplet, motion, speaker, volume/mute, gear, shield, door, garage, grass, person, battery, search, power, play/pause/next/prev, waterfall, plus/minus, chevron/chevDown, check, bell, bolt, water, refresh, calendar, pool, pergola, cloud, rain, snow.
- Avatars are initials on a generated hue — no photos.
- **No webfonts** — system font stack only.

## Files (in this bundle)
- `Home Control App.html` — entry/loader (+ global CSS, keyframes).
- `data.js` — device model + seed state (real names).
- `ui.jsx` — design system + icons + store context.
- `screens-main.jsx`, `screens-scenes.jsx`, `screens-more.jsx`, `screens-pool.jsx` — all screens.
- `app.jsx` — shell, theme tokens, nav, tab bar, customize logic.
- `ios-frame.jsx`, `tweaks-panel.jsx` — prototype-only scaffolding (device bezel + design controls); **omit from production**, but `app.jsx`'s `themeVars()` is the source of truth for theming.

### Suggested implementation order
1. Theme tokens (CSS variables, light/dark) from `themeVars()`.
2. Primitives: Icon set, Toggle, Slider (with `step`), Card, SectionTitle, Segmented, Tile, Avatar.
3. Store + API binding (reads → state, control writes via `setD` equivalent).
4. Shell: tab bar + nav stack + Customize + persistence.
5. Screens in priority order (Home, Lights, Doors, Climate, Pool…).
6. Schedules (editor + per-device arrays), then weather conditions + animations.
