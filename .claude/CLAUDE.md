# Home Control — Front-End Rebuild Brief

This repo is the new headless front-end for the Home Control system. Read this
file and the two contracts in `contracts/` before writing any code. The contracts
are authoritative; if anything here conflicts with a contract, the contract wins.

**UI spec is in `design/`.** `design/README.md` is the authoritative hi-fi design
spec (final tokens, every screen, interactions). `design/data.js` is the real device
model + seed state. The `.jsx` files are interactive prototypes to *recreate*, not
ship verbatim (no Babel-in-browser in production). `design/DESIGN.md`-equivalent
notes and the design↔contract mapping live in `DESIGN.md` at the repo root.

## Why we're rebuilding

The existing WordPress-themed site has three problems, and the architecture below
exists to solve each one:

1. **Slow front-end** — WordPress renders on every request. Fix: config is fetched
   from WP at build/ISR time and cached hard; the live app never waits on PHP.
2. **Clumsy on mobile** — a WP theme can't feel like an app. Fix: mobile-first React
   + PWA install.
3. **Inefficient subscriptions** — today the browser polls the Insteon hub directly,
   which multiplies hub load and races the shared PLM buffer. Fix: one server-side
   poller owns the hub, caches state, and fans out deltas over SSE. The browser
   subscribes once, to our service, never to a hub.

## The two-plane architecture

Do not let these two planes blur together. They have different data, different
update frequencies, and different transports.

**Config plane (rarely changes — devices, scenes, rooms, layout)**
- Source of truth: WordPress CPT + ACF (unchanged from the current system).
- Exposed headlessly via **WPGraphQL** (+ WPGraphQL for ACF).
- Front-end pulls it at build time with ISR, plus on-demand revalidation when an
  editor saves in WP (see config contract).
- Contract: `contracts/config-contract.md`

**State plane (changes constantly — live device status + commands)**
- Source of truth: the **existing home-control REST service** (already fronts
  Insteon + HVAC). This service hosts the poller, the state cache, the SSE stream,
  and the command endpoint.
- Transport: **SSE** for server→client deltas; plain `POST` for commands.
- Contract: `contracts/state-contract.md`

The front-end **joins** the two planes on a stable device id: config gives a tile
its identity, name, room, capabilities, and dashboard placement; state gives it its
live value. The join key is the device id, identical on both sides
(`design/data.js` is the seed for both — its catalogs are config, its flat
`initialState` values are state).

## Four kinds of state (don't shove everything into the device API)

The design's store keeps everything in one flat `st` map for prototype convenience,
but it is **four different concerns** in production. Routing them all through the
device-control service would be wrong:

1. **Device-control state** — lights, doors, climate, music, fans, pool, etc.
   → the state contract (`/state`, `/stream`, `/command`). This is the only thing
   the Insteon adapter owns.
2. **User / UI preferences** — `_favs.ids`, `_scenes.ids`, theme, accent, tab-bar
   layout. → persist per-user (WP user meta or localStorage). Not device state.
3. **Presence & ambient** — `person:<id>.home` (presence detection),
   `_global.weather`/`timeOfDay` (weather feed + clock). → their own sources.
4. **Automation engine** — `auto:<roomId>` (the per-room Scenes screen:
   automated/motion/doorOpen/manual/nightDim/intensity). → the automation system.
   The manual toggles are write-throughs that force/clear a sensor or override.

Build each behind its own thin client so the device stream stays clean. For this
build, prefs can start in localStorage and presence/weather/automation can read from
mock endpoints; only #1 must be real to control the house.

## Two decisions this surfaced

- **Schedules** (`pumpSchedules`, `heaterSchedules`, irrigation) are per-device,
  in-app-editable arrays. They are *control/automation* data, not WP content — route
  reads/writes through the home-control service (or a dedicated automation endpoint),
  not WPGraphQL. Treat them as part of concern #1/#4, not the config plane.
- **Pool / OmniLogic** — the design ships a complete Pool screen, but the OmniLogic
  adapter is the subsequent sub-project and does not exist yet. Build the Pool screen
  now against the mock; wire it to the OmniLogic adapter (local UDP,
  `pyomnilogic_local`) later. The `pool` state shape in the state contract is the
  target for that adapter, so nothing in the UI changes when it lands.

```
WordPress (CPT/ACF) ──WPGraphQL──▶ Next.js (ISR cache)  ┐
                                                         ├─▶ UI tiles (joined by id)
Home-control REST service ──SSE/POST──▶ Next.js client  ┘
   ├─ Insteon adapter (hub variables ⇄ device fields)
   ├─ HVAC adapter
   └─ OmniLogic adapter  ← LATER, separate sub-project, same contract
```

## Mock-first rule (critical for unblocking the build)

The entire front-end must be buildable without the home-control service being
reachable. Build a mock that serves the **exact** state contract — `/state`,
`/stream`, `/command` — emitting realistic deltas on a timer. The real service and
the mock are selected by an environment variable (`STATE_API_BASE_URL`), so swapping
mock → real is a config change, not a code change. No UI code may branch on
"mock vs real."

## Tech decisions (locked)

- **Framework:** Next.js (App Router) + TypeScript (strict). The design is plain
  React and ports cleanly; Next stays the choice for the config-plane ISR/caching
  even though `design/README.md` suggests a Vite default for greenfield.
- **Styling:** Tailwind, mapped to the **CSS-variable token system** that is already
  authoritative in `design/README.md` (light + dark). Do not invent colors/spacing;
  the README's token tables are final. Keep dark mode as a single `data-theme`
  attribute override.
- **Config transport:** WPGraphQL.
- **State transport:** SSE (server→client), POST (commands).
- **PWA:** installable, offline shows last-known cached state.

## Conventions

- The state model is a **flat map keyed by device id, mutated by shallow-merged
  patches** — the same shape as the design's `setD(id, patch)` store, the Insteon
  variable model, and the `/stream` deltas. In production, `setD(id, patch)` =
  POST the patch to `/command` (optimistic) + apply the confirmed patch from
  `/stream` (reconcile). One shared TS type per device class (from the state
  contract), imported by both the mock and the real client.
- **Render by device class, not vendor.** A light tile, lock tile, thermostat dial,
  etc. are chosen from the device's class/fields, never from which hub it came from.
  This is what lets the OmniLogic pool adapter land later with zero UI change.
- **Preserve shared ids.** A device shown on multiple screens uses one id so a patch
  updates everywhere — keep the single flat map.
- **Optimistic commands, authoritative stream.** Never treat the `202` as success;
  reconcile from `/stream`.
- **Keep the four kinds of state separate** (see above) — only device-control state
  touches the home-control service.
- Endpoints come from env vars only. No hard-coded hosts.

## Build milestones

0. Scaffold: Next.js + TS strict + Tailwind, repo layout, env scaffolding.
1. Tokens + primitives: port the token system + `reset/keyframes` and the `ui.jsx`
   primitives (Icon set, Toggle, Slider, Card, Segmented, Tile, Avatar) per
   `design/README.md`.
2. Config plane: WPGraphQL client + generated types modeled on `design/data.js`
   catalogs; ISR fetch + on-demand revalidate route. Render rooms/devices/scenes as
   **static** tiles (no live state yet). Seed mock fixtures from `data.js`.
3. Mock state service: `/state`, `/stream`, `/command` per the state contract,
   seeded from `data.js` initialState.
4. Wire UI to state: store over `/stream`, optimistic commands + reconcile,
   reconnect handling. Build screens in priority order (Home → Lights → Doors →
   Climate → Pool → rest), Pool against mock.
5. Swap mock → real: point `STATE_API_BASE_URL` at the home-control service. Verify
   Insteon + HVAC. UI should not change.
6. PWA: manifest, service worker, install prompt, offline last-known state.
7. (Later, separate sub-project) OmniLogic adapter behind the same state contract.

Milestones 1–4 require no hardware. Only milestone 5 touches the live service.
