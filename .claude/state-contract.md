# State Contract — Home-Control REST Service (live state + commands)

The **state plane**. Served by the existing home-control REST service, which owns the
poller, state cache, SSE stream, and command serialization. The browser talks only to
this service for state — never to a hub. Base URL = `STATE_API_BASE_URL`; the mock and
the real service expose the identical surface so the front-end never branches on which
is behind the URL.

## One model, three places (the key reconciliation)

The design's store, the Insteon hub, and this stream all use the **same shape**: a flat
map keyed by device id, mutated by shallow-merged **patches**.

- Design store: `setD(id, patch)` shallow-merges a patch into one device's state.
- Insteon: each device id maps to hub variables; the adapter reads them into these
  fields and writes them back on command.
- This contract: `/state` is the full map, `/stream` emits `{id, patch}` deltas,
  `/command` accepts `{target, patch}`.

So in production, `setD(id, patch)` becomes: **send the patch to `/command` (optimistic
update), then apply the confirmed patch that comes back on `/stream` (reconcile).** No
translation layer between the design's data model and the wire.

## Per-device state shapes (authoritative — from `design/data.js` initialState)

These are the exact fields each device class carries. The adapter's job is to produce
these from hub variables. "Writable" fields accept commands; read-only fields are
sensor reports only.

| device class            | id pattern        | state fields                                  | writable                    |
|-------------------------|-------------------|-----------------------------------------------|-----------------------------|
| Light                   | `lr-*`,`k-*`,…    | `{ on: bool, level: 0–100 }`                  | on, level                   |
| Exterior door (lock)    | `d-*`             | `{ locked: bool }`                            | locked                      |
| Interior door (sensor)  | `i-*`             | `{ open: bool, lowBattery?: bool }`           | read-only                   |
| Climate zone            | `cl-*`            | `{ temp: num, mode: str, lo: num, hi: num }`  | mode, lo/hi (setpoint ±0.5) |
| Music zone              | `m-*`             | `{ on: bool, vol: 0–100 }`                    | on, vol                     |
| Fan                     | `fan-N`           | `{ on: bool, speed: 0|1|2|3 }`                | on, speed (Off/Low/Med/Hi)  |
| Irrigation program      | `ip-*`            | `{ on: bool }`                                | on                          |
| Irrigation zone         | `iz-*`            | `{ mins: num }`                               | mins; `action:"run"`        |
| Leak sensor             | `leak-N`          | `{ wet: bool }`                               | read-only                   |
| Motion sensor           | `mo-N`            | `{ motion: bool, lowBattery?: bool }`         | read-only                   |
| Outdoor toggle          | `op-*`,`ob-*`     | `{ on: bool }`                                | on                          |
| Outdoor dimmer          | `ob-pergola-l`    | `{ on: bool, level: 0–100 }`                  | on, level                   |
| Settings flag (variable)| `s-*`,`e-*`,`sc-*`| `{ on: bool }`                                | most on; some read-only*    |
| Auto-lock               | `ob-autolock`     | `{ on: bool }`                                | on                          |

\* A few `e-*` flags (Outside Cold/Freezing/Hot, Season Is Winter) are sensor-derived
read-only variables, not user toggles. The adapter marks them read-only.

**Scenes** (`morning`, `away`, …) carry no device state; they are command targets only
(`action: "activate"`).

**Pool** (`pool`) is one composite device and is scoped to the OmniLogic sub-project —
see "Pool / OmniLogic scope" below. Its shape is documented there.

## Endpoints

### `GET /state` — full snapshot
The entire flat map, used to seed the store on load and on reconnect.
```json
{
  "lr-main":  { "on": true,  "level": 55 },
  "d-front":  { "locked": true },
  "cl-3":     { "temp": 74.0, "mode": "cool", "lo": 60, "hi": 73 },
  "m-living": { "on": true,  "vol": 34 },
  "fan-4":    { "on": true,  "speed": 2 },
  "mo-17":    { "motion": true },
  "ts":       "2026-06-04T17:02:11Z"
}
```

### `GET /stream` — SSE patch deltas
`text/event-stream`. One event per change the poller detects; the client merges the
patch into the matching id (exactly `setD`).
```
event: patch
data: {"id":"lr-main","patch":{"level":40},"ts":"2026-06-04T17:03:01Z"}

event: patch
data: {"id":"mo-17","patch":{"motion":false},"ts":"2026-06-04T17:03:04Z"}

: heartbeat
```
Emit a `: heartbeat` comment on an interval so proxies don't drop idle connections.
SSE auto-reconnects; on reconnect the client re-seeds from `/state`. Reachability is
just another patch field if the adapter loses a device: `{"id":"…","patch":{"reachable":false}}`.

### `POST /command` — issue a change
Patch for state changes; `action` for triggers. Returns `202` immediately.
```json
{ "target": "lr-main",  "patch": { "level": 40 } }
{ "target": "d-front",  "patch": { "locked": true } }
{ "target": "movie",    "action": "activate" }
{ "target": "iz-bg",    "action": "run" }
```
**The 202 is not confirmation of state.** Update optimistically, then reconcile when the
matching `/stream` patch arrives. The stream is always the source of truth.

## Adapter notes
- **Insteon** is the only thing that touches the hub: it reads the status variables into
  the fields above and fulfils a command by writing the corresponding variable(s).
  Polling, PLM-buffer reads, and command serialization all live here — one owner.
- Devices that appear on multiple screens (e.g. a pool light shown on Pool **and**
  Outdoors) share one id, so a patch updates everywhere. Preserve this — it's why the
  store is a single flat map.

## What does NOT belong on this stream
Several keys in the design's `st` are **not** device-control state. Do not route them
through this service (see `CLAUDE.md` → "Four kinds of state"):
- `_favs.ids`, `_scenes.ids`, theme/accent/tab-bar layout → **user prefs** (persist per-user).
- `person:<id>.home` → **presence** system.
- `_global.weather`, `_global.timeOfDay` → **weather feed** + clock.
- `auto:<roomId>` (the Scenes screen) → **automation engine** (separate endpoint).

## Pool / OmniLogic scope
The design ships a full **Pool** screen (pump speed 0–100 + presets, heater target,
pH target 7.0–8.0, chlorinator ORP set-point 600–800 mV, salt ppm, per-device
schedules). The OmniLogic adapter does **not** exist yet — it's the subsequent
sub-project. Resolution: **build the Pool screen now against the mock**, then wire it to
the OmniLogic adapter (local UDP, `pyomnilogic_local`) when that lands. Nothing in the
UI changes. The `pool` state shape below is the target contract for that adapter:
```json
"pool": {
  "pumpOn": true, "pumpSpeed": 65,
  "heaterOn": false, "heaterRunning": false, "poolTemp": 81, "heaterTarget": 84,
  "ph": 7.4, "phTarget": 7.6,
  "chlorinatorOn": true, "orpSet": 715, "orpNow": 702, "saltPPM": 3200,
  "pumpSchedules": [ { "id": "ps1", "enabled": true, "start": "06:00", "end": "10:00", "speed": 65, "days": [true,true,true,true,true,true,true] } ],
  "heaterSchedules": [ { "id": "hs1", "enabled": true, "start": "07:00", "end": "09:00", "target": 86, "days": [true,false,false,false,false,false,true] } ]
}
```
Readings (`poolTemp`, `ph`, `orpNow`, `saltPPM`) are read-only; targets and on/off
fields are writable. Schedules are arrays — see the schedules decision in `CLAUDE.md`.

## Mock requirement (build milestone 3)
Serve this contract exactly, seeded from `design/data.js`:
- `/state` returns the flat initialState map (real device ids/values).
- `/stream` emits plausible patches on a timer (a dimmer drifts, a motion sensor
  flips, pool temp wiggles) plus heartbeats.
- `/command` returns `202` and, after a short delay, emits the matching `/stream` patch
  so the optimistic→reconcile path runs end to end.
Repoint `STATE_API_BASE_URL` to the real service when ready; no front-end changes.
