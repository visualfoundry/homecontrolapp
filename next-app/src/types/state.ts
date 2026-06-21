// =============================================================================
// State model types — Home Control App
// Source of truth: .claude/state-contract.md
//
// One interface per device class. The flat StateMap is keyed by device id.
// Non-device keys (_favs, _global, person:*, auto:*) are typed separately.
// =============================================================================

// ---------------------------------------------------------------------------
// Device classes
// ---------------------------------------------------------------------------

export interface LightState {
  on: boolean;
  level: number; // 0–100
}

export interface LockState {
  locked: boolean;
}

export interface ContactSensorState {
  open: boolean;
  lowBattery?: boolean;
}

export interface ThermostatState {
  temp: number;
  mode: 'heat' | 'cool' | 'auto' | 'off';
  lo: number;
  hi: number;
  running?: 'idle' | 'heating' | 'cooling' | 'fan';
}

export interface SpeakerState {
  on: boolean;
  vol: number; // 0–100
}

export interface FanState {
  on: boolean;
  speed: 0 | 1 | 2 | 3; // Off / Low / Med / High
}

export interface IrrigationProgramState {
  on: boolean;
}

export interface IrrigationZoneState {
  mins: number;
}

export interface LeakSensorState {
  wet: boolean;
  lowBattery?: boolean;
}

export interface MotionSensorState {
  motion: boolean;
  lowBattery?: boolean;
}

export interface PoolValveState {
  value: number; // raw ST from device; compare to PoolValveDevice.openValue / closeValue
}

export interface OutdoorState {
  on: boolean;
  level?: number; // only for dimmable outdoor (ob-pergola-l)
}

export interface FlagState {
  on: boolean;
}

// ---------------------------------------------------------------------------
// Pool controller node (PG3 Balboa plugin — EISY 0, n003_bow1)
// ---------------------------------------------------------------------------

export interface PoolNodeState {
  // Circuit power — service returns 'on'; 'pumpOn' kept for forward-compat with OmniLogic adapter.
  on?: boolean;
  pumpOn?: boolean;
  waterTemp?: number;     // ST: pool water temperature °F
  ph?: number;            // GV1÷10: water pH
  orp?: number;           // GV2: ORP in mV
  saltLevel?: number;     // GV5: current salt level ppm
  saltLevelAvg?: number;  // GV6: averaged salt level ppm
  heaterFiring?: boolean; // GV7: heater is actively firing
}

// ---------------------------------------------------------------------------
// Pool composite (OmniLogic adapter — built against mock for now)
// ---------------------------------------------------------------------------

export interface PoolScheduleBase {
  id: string;
  enabled: boolean;
  start: string; // "HH:MM"
  end: string;
  days: [boolean, boolean, boolean, boolean, boolean, boolean, boolean]; // Sun–Sat
}

export interface PumpScheduleItem extends PoolScheduleBase {
  speed: number; // 0–100
}

export interface HeaterScheduleItem extends PoolScheduleBase {
  target: number; // °F
}

export interface PoolState {
  pumpOn: boolean;
  pumpSpeed: number;      // 0–100
  heaterOn: boolean;
  heaterRunning: boolean;
  poolTemp: number;
  heaterTarget: number;
  ph: number;
  phTarget: number;
  chlorinatorOn: boolean;
  orpSet: number;         // 600–800 mV
  orpNow: number;
  saltPPM: number;
  pumpSchedules: PumpScheduleItem[];
  heaterSchedules: HeaterScheduleItem[];
}

// ---------------------------------------------------------------------------
// Non-device state keys (user prefs, presence, ambient, automation)
// These do NOT go through the home-control state service.
// ---------------------------------------------------------------------------

export type TimeOfDay = 'Morning' | 'Day' | 'Evening' | 'Night';
export type WeatherCondition = 'Clear' | 'Cloudy' | 'Rain' | 'Snow';
export type SceneView = 'Detailed' | 'Compact';

export interface GlobalState {
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
}

export interface FavsState {
  ids: string[]; // ordered list of device ids pinned to Home dashboard
}

export interface ScenesListState {
  ids: string[]; // ordered list of scene ids pinned to Home dashboard
}

export interface PersonState {
  home: boolean;
}

export interface AutomationState {
  automated: boolean;
  motion: boolean;
  doorOpen: boolean;
  manual: boolean;
  nightDim: boolean;
  intensity: number; // 0–100
}

/** A numeric hub variable (e.g. 'Weather Variable Current Temperature'). */
export interface VariableState {
  value: number;
}

/** A text hub variable (e.g. 'Weather Variable Weather Conditions'). */
export interface TextVariableState {
  text: string;
}

// ---------------------------------------------------------------------------
// Union of all record types that can live in the flat state map
// ---------------------------------------------------------------------------

export type DeviceRecord =
  | LightState
  | LockState
  | ContactSensorState
  | ThermostatState
  | SpeakerState
  | FanState
  | IrrigationProgramState
  | IrrigationZoneState
  | LeakSensorState
  | MotionSensorState
  | OutdoorState
  | FlagState
  | PoolState
  | PoolNodeState
  | GlobalState
  | FavsState
  | ScenesListState
  | PersonState
  | AutomationState
  | VariableState
  | TextVariableState;

/** The full flat state map keyed by device id or special key. */
export type StateMap = Record<string, DeviceRecord>;

/** A shallow patch for any device record. */
export type StatePatch = Partial<DeviceRecord>;
