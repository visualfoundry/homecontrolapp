// =============================================================================
// TV power — one place, because three screens show the same switch.
//
// A TV's power lives on its room's Harmony hub, not on the TV control itself:
// the hub publishes the activity it is running, which is the only signal that
// knows the picture is on however it got there — the app, the physical Harmony
// remote, or the hub's own timeout. `powerId` points at whichever of the two
// the room actually has (see toAppConfig's TV section).
// =============================================================================

import type { StatePatch } from '@/types/state';
import type { TvDevice } from '@/types/config';

/** Starting an activity sequences a projector, a receiver and a source box, and
 *  the hub only reports it once that has finished — well past the 10 s the
 *  optimistic lock allows by default. Holding the switch this long is what stops
 *  it flicking back to Off halfway through turning the room on. */
export const TV_POWER_LOCK_MS = 60_000;

/** Read power for a TV out of the flat state map. */
export function tvIsOn(tv: TvDevice, st: Record<string, unknown>): boolean {
  return (st[tv.powerId] as { on?: boolean } | undefined)?.on ?? false;
}

/** The patch that turns a TV on or off.
 *  On a hub, "off" is activity 0 — the hub's own power-off, not an activity. */
export function tvPowerPatch(tv: TvDevice, on: boolean): StatePatch {
  if (tv.powerOnActivity == null) return { on } as StatePatch;
  return { on, activity: on ? tv.powerOnActivity : 0 } as StatePatch;
}
