# Config Contract — WordPress (CPT/ACF) via WPGraphQL

The **config plane**. Rarely changes. Defines *what exists and how it's laid out* —
not live values. Source of truth is the existing CPT + ACF setup, unchanged. The
authoritative model for this is **`design/data.js`**: its catalogs (rooms→devices,
scenes, favCatalog, sceneRooms, people, settings groups) are the config plane; its
flat `initialState` values are the *state* plane and belong to the state contract.

## Join key
Every device's config `id` MUST equal the `id` used by the state service and the
design's flat map. `design/data.js` ids are the canonical set (`lr-main`, `d-front`,
`cl-3`, `fan-4`, `pool`, …). If WP ids and hub ids diverge, reconcile **at the
adapter**, never in the UI.

## Device classes (config declares the class; state fills the fields)
The UI picks a tile from the class; the state contract lists each class's fields.

| class            | examples                          | id pattern         |
|------------------|-----------------------------------|--------------------|
| light            | room lights (on/level)            | `lr-*`,`k-*`,…     |
| lock             | exterior doors                    | `d-*`              |
| contact-sensor   | interior doors (read-only)        | `i-*`              |
| thermostat       | climate zones                     | `cl-*`             |
| speaker          | music zones                       | `m-*`              |
| fan              | fans (Off/Low/Med/High)           | `fan-*`            |
| irrigation       | programs + zones                  | `ip-*`,`iz-*`      |
| leak-sensor      | leak sensors (read-only)          | `leak-*`           |
| motion-sensor    | motion sensors (read-only)        | `mo-*`             |
| outdoor          | toggles + one dimmer              | `op-*`,`ob-*`      |
| flag             | settings variables                | `s-*`,`e-*`,`sc-*` |
| pool             | composite (OmniLogic, later)      | `pool`             |
| scene            | one-tap routines (trigger only)   | scene ids          |

New OmniLogic devices declare class `pool`/`sensor`/`switch`-style fields and render
with the existing tiles — no new UI.

## What config provides (modeled on `data.js`)
- **Rooms → devices** grouping (light rooms, etc.) with names + order.
- **Scenes catalog** (`scenes`: id/name/icon/tint) + the default Home set (`sceneDefault`).
- **Favorites catalog** (`favCatalog`: grouped `{id, icon, label}`) + default pins
  (`favorites`). `id` must match a real device id.
- **Per-room automation defs** (`sceneRooms`: type/hasDoor/hasNightDim) and
  `sceneSchedules` (scene name per room-type per time-of-day). The *live* automation
  values (`auto:<roomId>`) are runtime state, not config — see `CLAUDE.md`.
- **People** (`people`: id/name) — presence values are runtime, not config.
- Per-device metadata the tiles need: icon, tint, setpoint range (climate lo/hi,
  pH 7.0–8.0, ORP 600–800), fan speed steps, unit.

## GraphQL shape (target)
Expose ACF through WPGraphQL for ACF; resolve to roughly this (field names match your
ACF group keys, keep the structure). Generate TS types from the schema (codegen).
```graphql
query HomeConfig {
  rooms(first: 100) { nodes { id name order devices { nodes { ...DeviceConfig } } } }
  scenes(first: 100) { nodes { id name icon tint order } }
  sceneRooms(first: 100) { nodes { id name type hasDoor hasNightDim } }
  favCatalog { groups { group items { id icon label } } }
  people(first: 50) { nodes { id name } }
  layout { dashboardSceneIds dashboardFavIds defaultTabs }
}
fragment DeviceConfig on Device {
  id            # MUST equal state id
  name
  class         # light | lock | thermostat | fan | speaker | …
  room { node { id } }
  icon
  tint
  order
  meta { unit setpointMin setpointMax modeOptions speedSteps }
}
```

## Freshness strategy
- **Build / ISR:** fetch config at build with `revalidate`; the app never blocks on WP.
- **On-demand revalidation:** a WP `save_post`/ACF-save hook POSTs to a Next
  `/api/revalidate?secret=…` route so edits appear without a full rebuild. Protect
  with a shared-secret env var.

## Out of scope for config
No live values, no commands, no schedules (schedules are control/automation data — see
`CLAUDE.md`). Config knows the Kitchen "Main" light *exists*, is class `light`, lives
in Kitchen — not whether it's on.
