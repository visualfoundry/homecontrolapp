# Design Reference & Mapping

The authoritative design spec is **`design/README.md`** — final tokens (light + dark),
every screen, every interaction, the icon set, and the prototype architecture. Do not
duplicate or re-derive its token tables; treat them as final. This file only covers
how the design maps onto the architecture in `CLAUDE.md` and the contracts.

## Token system (authoritative source: `design/README.md`)
- CSS-variable tokens; light on `:root`, dark via `[data-theme="dark"]`. Default
  accent `#E0483D` (kept from legacy brand); `--radius` 22px; screen padding 18px;
  grid gap 12px. System font stack, **no webfont**. All icons are inline SVG (24×24,
  `currentColor`) — port to your icon system. Map tokens into Tailwind `theme.extend`;
  keep dark mode as the single attribute toggle.

## Component inventory → device class → contract
Each prototype component maps to a device class (config) and a per-device field set
(state). This is the join that makes tiles render.

| component (design)        | device class    | reads (state fields)        | writes (command)        |
|---------------------------|-----------------|-----------------------------|-------------------------|
| LightBar / Tile           | light           | `on, level`                 | `{on}` / `{level}`      |
| Tile (lock)               | lock            | `locked`                    | `{locked}`              |
| sensor row                | contact-sensor  | `open, lowBattery`          | read-only               |
| thermostat dial           | thermostat      | `temp, mode, lo, hi`        | `{mode}` `{lo}` `{hi}`  |
| speaker row               | speaker         | `on, vol`                   | `{on}` `{vol}`          |
| fan card                  | fan             | `on, speed (0–3)`           | `{on}` `{speed}`        |
| program toggle / zone row | irrigation      | `on` / `mins`               | `{on}` / action `run`   |
| leak row                  | leak-sensor     | `wet`                       | read-only               |
| motion row                | motion-sensor   | `motion, lowBattery`        | read-only               |
| Tile / dimmer (outdoor)   | outdoor         | `on (, level)`              | `{on}` `{level}`        |
| toggle list (Settings)    | flag            | `on`                        | `{on}` (some read-only) |
| Pool screen               | pool            | pool composite (see state)  | targets/on-off (LATER)  |
| SceneButton / chip        | scene           | —                           | action `activate`       |

Non-device components (route elsewhere, see `CLAUDE.md` → Four kinds of state):
`Avatar`/Who's-Home → presence; Scenes-screen room cards → automation engine;
Weather tile → weather feed; Favorites/Scenes edit + tab bar → user prefs.

## Mobile / PWA notes (from `design/README.md`)
Mobile-first: bottom tab bar (4 user-chosen + pinned More), frosted with safe-area
padding; secondary screens push with a back chevron; min tap target ~44px. Installable
PWA, offline shows last-known cached state. Light **and** dark are first-class.

## Build order (folds into CLAUDE.md milestones)
Tokens + primitives (`ui.jsx`) → store over the patch contract → shell (tab bar + nav
+ Customize + persistence) → screens Home → Lights → Doors → Climate → Pool → rest →
schedules editor + weather animations. Pool is built against the mock until the
OmniLogic adapter exists.
