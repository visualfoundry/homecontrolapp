// =============================================================================
// State mapper — ISY raw values → typed state shapes
//
// Each device class maps to the exact state shape the UI expects
// (per state-contract.md). Raw ISY node values are 0–255 (ST property).
// ISY variable values are raw integers.
//
// THERMOSTAT NOTE: EISYs use whole-degree resolution (e.g. 72 = 72°F).
// No scaling is applied to temperature values.
// =============================================================================

import type { NodeProps } from './eisy-client.js';

// ---------------------------------------------------------------------------
// Device class registry
// ---------------------------------------------------------------------------

export type DeviceClass =
  | 'light-dimmer'
  | 'light-switch'
  | 'fan'
  | 'lock'
  | 'contact-sensor'
  | 'motion-sensor'
  | 'leak-sensor'
  | 'toggle'
  | 'speaker'
  | 'thermostat'
  | 'flag'
  | 'numeric-var'
  | 'pool-controller'
  | 'motion-battery'
  | 'leak-battery'
  | 'contact-battery'
  | 'pool-valve'
  | 'harmony-device'
  | 'harmony-hub';

export interface DeviceEntry {
  /** 'device' = Insteon node; 'variable' = ISY integer/state variable */
  type: 'device' | 'variable';
  eisyIdx: number;
  class: DeviceClass;
  // Device fields
  address?: string;
  // Variable fields (set by export-devices script after probing EISYs)
  varType?: 1 | 2;
  varId?: number;
  // contact-battery: stateId of the contact-sensor variable to patch with lowBattery
  linkedStateId?: string;
  // harmony-device / harmony-hub: friendly name and the hub (room) it hangs off,
  // both straight from the Harmony plugin — these nodes have no WP control
  // behind them.
  name?: string;
  hub?: string;
}

export type DevicesMap = Record<string, DeviceEntry>;

// ---------------------------------------------------------------------------
// Insteon fan speed encoding (SwitchLinc Fan Controller)
// Off=0, Low=85, Med=170, High=255
// ---------------------------------------------------------------------------

const FAN_SPEED_TO_RAW: Record<number, number> = { 0: 0, 1: 85, 2: 170, 3: 255 };

function rawToFanSpeed(st: number): number {
  if (st === 0) return 0;
  if (st <= 85)  return 1;
  if (st <= 170) return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// Thermostat mode encoding
// ---------------------------------------------------------------------------

const THERMO_MODES = ['off', 'heat', 'cool', 'auto', 'fan'] as const;
// CLIHCS: 0=Idle, 1=Heating, 2=Cooling, 3=Fan only
const THERMO_RUN   = ['idle', 'heating', 'cooling', 'fan'] as const;

// ---------------------------------------------------------------------------
// Node → typed state
// ---------------------------------------------------------------------------

/**
 * Convert an ISY node's properties to the state shape expected by the UI.
 * `props` is the full property map for that node from /rest/status.
 */
export function nodeToState(
  cls: DeviceClass,
  props: NodeProps,
): Record<string, unknown> {
  const st = props.get('ST') ?? 0;

  switch (cls) {
    case 'light-dimmer':
      return { on: st > 0, level: Math.round((st / 255) * 100) };

    case 'light-switch':
    case 'toggle':
      return { on: st > 0 };

    case 'fan':
      return { on: st > 0, speed: rawToFanSpeed(st) };

    case 'lock':
      return { locked: st > 0 };

    case 'contact-sensor':
      return { open: st > 0 };

    case 'motion-sensor':
      return { motion: st > 0 };

    case 'leak-sensor':
      return { wet: st > 0 };

    case 'harmony-device':
      // Write-only: IR is one-way, so a remote button has no readable state.
      // Reporting `on` here would invent a status the hub never confirms.
      return {};

    case 'harmony-hub': {
      // GV3 is the activity the hub is currently running (0 = Power Off). It is
      // the one two-way signal the Harmony side gives us, and it moves whoever
      // started the activity — the app, the physical remote, or the hub itself.
      // Everything the room's power switch shows and sends hangs off it.
      const activity = props.get('GV3') ?? 0;
      return { on: activity > 0, activity };
    }

    case 'pool-valve':
      return { on: st > 0 };

    case 'speaker':
      return { on: st > 0, vol: Math.round((st / 255) * 100) };

    case 'thermostat': {
      const raw = (prop: string) => props.get(prop) ?? 0;
      const modeIdx = raw('CLIMD');
      const runIdx  = raw('CLIHCS');
      // All temps use raw = °F × 2 (÷2 to read, ×2 to write).
      // CLISPC = cooling setpoint (hi); CLISPH = heating setpoint (lo).
      const temp = raw('ST')     / 2;
      const hi   = raw('CLISPC') / 2;
      const lo   = raw('CLISPH') / 2;
      const mode = THERMO_MODES[modeIdx] ?? 'off';

      // Prefer CLIHCS when the hardware reports it (runIdx > 0 = actively running).
      // Many ISY thermostat nodes omit CLIHCS from /rest/status; in that case infer
      // running state from whether current temp has reached the setpoint.
      let running: typeof THERMO_RUN[number];
      if (runIdx > 0) {
        running = THERMO_RUN[runIdx] ?? 'idle';
      } else if ((mode === 'heat' || mode === 'auto') && temp < lo) {
        running = 'heating';
      } else if ((mode === 'cool' || mode === 'auto') && temp > hi) {
        running = 'cooling';
      } else {
        running = 'idle';
      }

      return { temp, hi, lo, mode, running };
    }

    case 'pool-controller': {
      // PG3 Balboa node (n003_bow1) on EISY 0.
      // GV1 stores pH × 10 (e.g. 72 → 7.2); all others are raw values.
      const gv = (prop: string) => props.get(prop) ?? 0;
      return {
        pumpOn:       gv('GV0') > 0,
        ph:           gv('GV1') / 10,
        orp:          gv('GV2'),
        waterTemp:    gv('ST'),
        saltLevel:    gv('GV5'),
        saltLevelAvg: gv('GV6'),
        heaterFiring: gv('GV7') > 0,
      };
    }

    default:
      return { on: st > 0 };
  }
}

// ---------------------------------------------------------------------------
// Variable → typed state
// ---------------------------------------------------------------------------

/** Convert a raw ISY variable value to the state shape expected by the UI. */
export function varToState(
  cls: DeviceClass,
  val: number,
): Record<string, unknown> {
  switch (cls) {
    case 'numeric-var':
      return { value: val };

    case 'light-dimmer':
      // Variable-backed dimmers store raw ISY level (0–255)
      return { on: val > 0, level: Math.round((val / 255) * 100) };

    case 'contact-sensor':
      return { open: val !== 0 };

    case 'motion-sensor':
      return { motion: val !== 0 };

    case 'speaker':
      // Variable-backed speakers store volume (0–100)
      return { on: val > 0, vol: val };

    case 'lock':
      return { value: val };

    case 'flag':
    default:
      return { on: val !== 0 };
  }
}

// ---------------------------------------------------------------------------
// Command → ISY parameters
// ---------------------------------------------------------------------------

export interface NodeCommand {
  cmd: string;
  value?: number;
}

/**
 * Translate a UI state patch into an ISY node command.
 * Returns null if no command applies (e.g. read-only sensor).
 */

// ---------------------------------------------------------------------------
// Harmony remote buttons
//
// Every Harmony device node accepts SET_BUTTON <index> against one shared
// 322-entry button table (verified identical across all 22 device nodes on
// EISY 0), so a single map serves every room. Only the buttons the remote UI
// offers are listed — sending an index a given device has no IR code for is a
// silent no-op on the hub, so unknown names are rejected here instead.
// ---------------------------------------------------------------------------

export const HARMONY_BUTTONS = {
  DirectionDown:  0,
  DirectionLeft:  1,
  DirectionRight: 2,
  DirectionUp:    3,
  Select:         4,
  Stop:           5,
  Play:           6,
  Rewind:         7,
  Pause:          8,
  FastForward:    9,
  Back:          13,
  Mute:          22,
  VolumeDown:    23,
  VolumeUp:      24,
} as const;

export type HarmonyButton = keyof typeof HARMONY_BUTTONS;

export function patchToNodeCommand(
  cls: DeviceClass,
  patch: Record<string, unknown>,
  action?: string,
): NodeCommand | null {
  if (action === 'activate') return { cmd: 'DON' };

  switch (cls) {
    case 'light-dimmer': {
      if ('level' in patch) {
        const eisyVal = Math.round(((patch.level as number) / 100) * 255);
        return eisyVal > 0 ? { cmd: 'DON', value: eisyVal } : { cmd: 'DOF' };
      }
      if ('on' in patch) return { cmd: patch.on ? 'DON' : 'DOF' };
      return null;
    }

    case 'light-switch':
    case 'toggle':
    case 'speaker':
      if ('on' in patch) return { cmd: patch.on ? 'DON' : 'DOF' };
      return null;

    case 'fan': {
      // Speed button: send level-specific command
      if ('speed' in patch) {
        const raw = FAN_SPEED_TO_RAW[patch.speed as number] ?? 0;
        return raw > 0 ? { cmd: 'DON', value: raw } : { cmd: 'DOF' };
      }
      // Toggle: plain DON/DOF — device uses its own configured speed
      if ('on' in patch) return { cmd: patch.on ? 'DON' : 'DOF' };
      return null;
    }

    case 'lock':
      if ('locked' in patch) return { cmd: patch.locked ? 'DON' : 'DOF' };
      return null;

    case 'pool-valve':
      if ('on' in patch) return { cmd: patch.on ? 'DON' : 'DOF' };
      return null;

    case 'harmony-hub': {
      // Power in Harmony is an activity, not a switch: starting one sequences
      // the room's boxes and inputs, and the hub's own DOF ends whichever is
      // running. `activity: 0` therefore means "power off", not "activity zero".
      if ('activity' in patch) {
        const idx = Number(patch.activity);
        if (!Number.isFinite(idx)) return null;
        return idx > 0 ? { cmd: 'SET_ACTIVITY', value: idx } : { cmd: 'DOF' };
      }
      // `on: false` is unambiguous on its own; `on: true` is not — which
      // activity to start is the caller's to say, so it is dropped rather than
      // guessed at.
      if (patch.on === false) return { cmd: 'DOF' };
      return null;
    }

    case 'harmony-device': {
      // Momentary IR button — there is no state to converge on, so this is the
      // one class whose commands are fire-and-forget (see /command).
      if ('button' in patch) {
        const idx = HARMONY_BUTTONS[patch.button as HarmonyButton];
        // 0 is a valid index (DirectionDown) — check for presence, not truthiness.
        return idx !== undefined ? { cmd: 'SET_BUTTON', value: idx } : null;
      }
      if ('on' in patch) return { cmd: patch.on ? 'DON' : 'DOF' };
      return null;
    }

    case 'thermostat': {
      if ('mode' in patch) {
        const modeIdx = THERMO_MODES.indexOf(patch.mode as typeof THERMO_MODES[number]);
        if (modeIdx >= 0) return { cmd: 'CLIMD', value: modeIdx };
      }
      // UI sends °F; EISY expects raw = °F × 2 (inverse of nodeToState ÷ 2)
      if ('hi' in patch) return { cmd: 'CLISPC', value: Math.round((patch.hi as number) * 2) };
      if ('lo' in patch) return { cmd: 'CLISPH', value: Math.round((patch.lo as number) * 2) };
      return null;
    }

    default:
      if ('on' in patch) return { cmd: patch.on ? 'DON' : 'DOF' };
      return null;
  }
}
