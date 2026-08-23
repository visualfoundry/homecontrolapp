// =============================================================================
// Config model types — Home Control App
// Source of truth: .claude/config-contract.md
//
// Config is fetched from WordPress (WPGraphQL) at build/ISR time.
// These types mirror the GraphQL schema and design/data.js catalogs.
// =============================================================================

import type { SceneView } from '@/types/state';
import type { IconName } from '@/components/Icon';

// ---------------------------------------------------------------------------
// Device config
// ---------------------------------------------------------------------------

export type DeviceClass =
  | 'light'
  | 'lock'
  | 'contact-sensor'
  | 'thermostat'
  | 'speaker'
  | 'fan'
  | 'irrigation'       // program
  | 'irrigation-zone'
  | 'leak-sensor'
  | 'motion-sensor'
  | 'outdoor'
  | 'flag'
  | 'pool'
  | 'scene';

export interface DeviceMeta {
  unit?: string;
  setpointMin?: number;
  setpointMax?: number;
  modeOptions?: string[];
  speedSteps?: string[]; // e.g. ['Off','Low','Med','High']
}

export interface DeviceConfig {
  id: string;          // MUST equal state id
  name: string;
  class: DeviceClass;
  roomId: string;
  icon: string;
  tint: string;
  order: number;
  meta?: DeviceMeta;
}

// ---------------------------------------------------------------------------
// Room config
// ---------------------------------------------------------------------------

export interface RoomConfig {
  id: string;
  name: string;
  order: number;
  devices: DeviceConfig[];
}

// ---------------------------------------------------------------------------
// Scenes catalog
// ---------------------------------------------------------------------------

export interface SceneConfig {
  id: string;
  name: string;
  icon: string;
  tint: string;
  order: number;
}

// ---------------------------------------------------------------------------
// Favorites catalog
// ---------------------------------------------------------------------------

export interface FavItem {
  id: string;   // matches a device id in state
  icon: string;
  label: string;
  place?: string; // optional sub-group header (e.g. room name within Lights)
}

export interface FavGroup {
  group: string;
  items: FavItem[];
}

// ---------------------------------------------------------------------------
// Per-room automation config (scene engine)
// ---------------------------------------------------------------------------

export type SceneRoomType = 'living' | 'bedroom' | 'bath' | 'kitchen' | 'office' | 'outdoor' | 'utility' | 'hall';

export interface SceneRoomConfig {
  id: string;
  name: string;
  type: SceneRoomType;
  hasDoor: boolean;
  hasNightDim: boolean;
  /** Number of intensity steps from the 'Light Scene N Step' control type
   *  (N = 2–6). The slider snaps to N intervals (N+1 stops incl. 0). */
  steps?: number;
  /** Place (room) this scene belongs to — nav target for its room page. */
  place?: string;
  // Optional: actual WP device IDs for associated controls in the same place.
  // Presence of an ID means the control exists and should be shown.
  motionId?:    string;  // Motion Sensor
  switchId?:    string;  // Override Switch
  autoId?:      string;  // Auto Switch
  doorId?:      string;  // Door Interior
  nightDimId?:  string;  // Door Switch LED (night LEDs)
  timerWaitId?: string;  // Timer Wait variable (motion timer)
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export interface PersonConfig {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Layout preferences (from WP, default tab/scene/fav selections)
// ---------------------------------------------------------------------------

export interface LayoutConfig {
  dashboardSceneIds: string[];
  dashboardFavIds: string[];
  defaultTabs: string[];
}

// ---------------------------------------------------------------------------
// Full config payload (result of the HomeConfig GraphQL query)
// ---------------------------------------------------------------------------

export interface HomeConfig {
  rooms: RoomConfig[];
  scenes: SceneConfig[];
  sceneRooms: SceneRoomConfig[];
  favCatalog: FavGroup[];
  people: PersonConfig[];
  layout: LayoutConfig;
}

// ---------------------------------------------------------------------------
// Raw WPGraphQL response shape — real WP CPT/ACF structure
// ---------------------------------------------------------------------------

export interface ControlTypeFieldsRaw {
  controlTypeType:   string | null;
  controlTypeMethod: string | null;
}

export interface ControlTypeNodeRaw {
  databaseId: number;
  title: string;
  controlTypeFields: ControlTypeFieldsRaw | null;
}

export interface PlaceNodeRaw {
  databaseId: number;
  title: string;
}

export interface ControlFieldsRaw {
  controlIsy: string[] | null;
  controlIsyControlType: string | null;
  controlAddress: string | null;
  controlVariableId: number | null;
  controlVariableValueCopy: boolean | null;
  controlVariableHardwareValueOpen:  number | null;
  controlVariableHardwareValueClose: number | null;
  controlType:  { nodes: ControlTypeNodeRaw[] } | null;
  controlPlace: { nodes: PlaceNodeRaw[] } | null;
}

export interface ControlNodeRaw {
  databaseId: number;
  title: string;
  controlFields: ControlFieldsRaw | null;
}

export interface HomeConfigRaw {
  controls: { nodes: ControlNodeRaw[] };
}

// ---------------------------------------------------------------------------
// Device catalog types (mirrors data.js structure, used by AppConfig)
// ---------------------------------------------------------------------------

export interface LightDevice      { id: string; name: string; kind?: 'dimmer' | 'switch' }
export interface LightSceneDevice { id: string; steps: number }
export interface LightRoom        { room: string; lights: LightDevice[]; scene?: LightSceneDevice }
export interface LightSceneRoom   { id: string; name: string; steps: number }
export interface ExteriorDoor  { id: string; name: string; autoLockId?: string; openId?: string }
export interface InteriorSensor{ id: string; name: string }
export interface ClimateZone   { id: string; name: string }
export interface MusicZone     { id: string; name: string }
export interface FanDevice     { id: string; name: string }
export interface IrrigationProgram { id: string; name: string }
export interface IrrigationZone    { id: string; name: string }
export interface SensorDevice  { id: string; name: string }
export interface OutdoorDevice { id: string; name: string; kind: 'toggle' | 'dimmer'; icon?: IconName }
export interface PoolValveDevice {
  id: string;
  name: string;
  openStateId: string;  // EISY state ID for the relay sub-node that opens the valve
  closeStateId: string; // EISY state ID for the relay sub-node that closes the valve
}
export interface SettingItem   { id: string; name: string }

// ---------------------------------------------------------------------------
// Harmony remote
//
// A TV control's on/off runs through an EISY variable, but the remote buttons go
// straight to Harmony device nodes on that room's hub. Buttons are addressed per
// device, and the right target differs by button group — volume usually belongs
// to the amp, navigation and transport to the source box.
// ---------------------------------------------------------------------------

export interface RemoteDevice {
  id: string;
  name: string;
  /** Buttons this box has an IR code for, straight from its EISY profile. */
  buttons: RemoteButton[];
  /** False when the EISY publishes no profile for the node, so `buttons` is the
   *  full set on spec. Such a box is still driveable but only wins a button no
   *  profiled box in the room claims. */
  buttonsKnown: boolean;
}

/** One activity the hub can start. Index is this hub's SET_ACTIVITY value. */
export interface RemoteActivity {
  index: number;
  name: string;
}

export interface RemoteConfig {
  /** Hub state id, e.g. "eisy0/n011_h1b97d7de5be5c". */
  hubId: string;
  /** Room name as the Harmony hub reports it. */
  hubName: string;
  /** Every button-capable device on this hub, in hub order. */
  devices: RemoteDevice[];
  /** Which device each button is sent to. A button missing from this map is one
   *  no box in the room can perform, and the remote doesn't draw a key for it —
   *  the hub answers 404 for a button a device never learned. */
  routes: Partial<Record<RemoteButton, string>>;
  /** Activities this hub can start, lowest index first. */
  activities: RemoteActivity[];
  /** The activity the room's power switch starts, or null when the hub
   *  publishes none — off still works, on has nothing to start. */
  powerOnActivity: number | null;
}

/** The 14 buttons the remote offers. Names match the Harmony button table. */
export const REMOTE_BUTTONS = [
  'VolumeUp', 'VolumeDown', 'Mute',
  'DirectionUp', 'DirectionDown', 'DirectionLeft', 'DirectionRight', 'Select', 'Back',
  'Play', 'Pause', 'Stop', 'Rewind', 'FastForward',
] as const;

export type RemoteButton = typeof REMOTE_BUTTONS[number];

export interface TvDevice extends SettingItem {
  /** Present when this room's TV has a Harmony hub behind it. */
  remote?: RemoteConfig;
  /** Where power is read and written. The Harmony hub node where the room has
   *  one — it is the only thing that knows the picture is actually on, and it
   *  moves when the physical remote is used. Falls back to this TV's own
   *  WP-authored EISY variable where there is no hub. */
  powerId: string;
  /** Activity to start when powering on. Set only when `powerId` is a hub. */
  powerOnActivity?: number;
}

export type SceneRoomTypeKey = 'bedroom' | 'bath' | 'living' | 'utility' | 'hall';
export type TimeOfDayKey = 'Morning' | 'Day' | 'Evening' | 'Night';
export type SceneSchedules = Partial<Record<SceneRoomTypeKey, Partial<Record<TimeOfDayKey, string>>>>;

// ---------------------------------------------------------------------------
// AppConfig — full catalog used by the app at runtime.
// Returned by fetchConfig(); built from WPGraphQL or mock data.ts fallback.
// ---------------------------------------------------------------------------

export interface AppConfig {
  scenes: SceneConfig[];
  sceneDefault: string[];
  lightSceneRooms: LightSceneRoom[];
  people: PersonConfig[];
  lightRooms: LightRoom[];
  doorsExterior: ExteriorDoor[];
  doorsInterior: InteriorSensor[];
  climate: ClimateZone[];
  musicZones: MusicZone[];
  fans: FanDevice[];
  tvs: TvDevice[];
  irrigationPrograms: IrrigationProgram[];
  irrigationZones: IrrigationZone[];
  leakSensors: SensorDevice[];
  motionSensors: SensorDevice[];
  outdoorsPool: OutdoorDevice[];
  poolValves: PoolValveDevice[];
  outdoorsBackyard: OutdoorDevice[];
  garage: SettingItem[];
  garageDoors: ExteriorDoor[];
  garageCarDoors: SettingItem[];
  garageCars: SettingItem[];
  /** Scene-room id of the Garage light scene (place 'Garage'), or null. */
  garageSceneId: string | null;
  whoIsHome: SettingItem[];
  settingsSecurity: SettingItem[];
  settingsEnvironment: SettingItem[];
  settingsSchedules: SettingItem[];
  settingsHouse: SettingItem[];
  sceneRooms: SceneRoomConfig[];
  sceneSchedules: SceneSchedules;
  favorites: string[];
  favCatalog: FavGroup[];
  /** Device id → place (room) title. Used to assemble per-place room pages. */
  controlPlaces: Record<string, string>;
  /** Config id (databaseId) → state-service id (ISY device address or variable id).
   *  Used by the /api proxy to reconcile config ids with state ids. */
  controlStateIds: Record<string, string>;
  /** Device ids of the Weather Variable controls (temperature/conditions), or null. */
  weatherTempId: string | null;
  weatherHighId: string | null;
  weatherLowId: string | null;
  weatherCondId: string | null;
  /** Device id of the House Status variable (value 1=Morning, 2=Day, 3=Evening, 4=Night). */
  houseStatusId: string | null;
  /** Device id of the House Climate variable (WP 488, value 1=Home, 2=Away, 3=Sleep). */
  houseClimateId: string | null;
  /** Controls marked control_variable_environmental=true — shown in the Environments section on HomeScreen. */
  environmentalControls: Array<{ id: string; name: string }>;
  /** Pool temperature variable (WP 622, eisy0/var/128). State shape: { value: number } °F. */
  poolNodeId: string | null;
  /** Pool chlorinator on/off variable. State shape: { value: number } (1=on, 0=off). */
  poolChlorinatorId: string | null;
  /** Pool heater on/off variable (WP 533, eisy0/var/5). State shape: { value: number } (1=on, 0=off). */
  poolHeaterId: string | null;
  /** Pool pump on/off variable (WP 623, eisy0/var/123). State shape: { value: number } (1=on). */
  poolPumpNodeId: string | null;
  /** Pool pump speed variable (WP 273, eisy0/var/124). State shape: { value: number } 0–100%. */
  poolPumpSpeedId: string | null;
  /** Pool heater setpoint variable (WP 624, eisy0/var/126). State shape: { value: number } °F. */
  poolHeaterSetpointId: string | null;
  /** Pool heater firing indicator. State shape: { value: number } (1=firing, 0=not). */
  poolHeaterFiringId: string | null;
  /** Pool pH indicator. State shape: { value: number } (raw integer; ÷10 if >14). */
  poolPhId: string | null;
  /** Pool ORP indicator. State shape: { value: number } mV. */
  poolOrpId: string | null;
  /** Pool salt level indicator. State shape: { value: number } ppm. */
  poolSaltLevelId: string | null;
  /** Pool salt level average indicator. State shape: { value: number } ppm. */
  poolSaltLevelAvgId: string | null;
}

// ---------------------------------------------------------------------------
// User preferences (localStorage — not device state, not config)
// ---------------------------------------------------------------------------

export interface UserPrefs {
  theme: 'light' | 'dark' | 'system';
  accent: string;
  radius: number;       // 10–30
  density: 'compact' | 'regular' | 'comfy';
  font: 'system' | 'rounded';
  tabs: string[];       // up to 4 section ids for the tab bar
  sceneView: SceneView; // Scenes screen layout: Detailed / Compact
}

export const DEFAULT_PREFS: UserPrefs = {
  theme: 'system',
  accent: '#E0483D',
  radius: 22,
  density: 'regular',
  font: 'system',
  tabs: ['home', 'scenes', 'pool', 'music'],
  sceneView: 'Detailed',
};

// ---------------------------------------------------------------------------
// Notification preferences (localStorage — which events the user wants alerts for)
// ---------------------------------------------------------------------------

export interface NotificationPrefs {
  leak: boolean;
  motion: boolean;
  doors: boolean;
  houseSecurity: boolean;
  whoIsHome: boolean;
  houseMode: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  leak: false,
  motion: false,
  doors: false,
  houseSecurity: false,
  whoIsHome: false,
  houseMode: false,
};

// ---------------------------------------------------------------------------
// In-app notification inbox
// ---------------------------------------------------------------------------

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  category?: 'leak' | 'motion' | 'doors' | 'houseSecurity' | 'whoIsHome' | 'houseMode' | 'push' | 'other';
  /** Screen id to open when the row is tapped (e.g. "leak", "doors", "room:Kitchen").
   *  Set from the push payload's ?screen= param; falls back to the category map. */
  screen?: string;
  /** Collapse key from the push payload (its alertKey). A repeating alert keeps
   *  one row, refreshed in place, instead of one row per repeat. */
  tag?: string;
  /** Condition serious enough to keep alerting about — currently leaks only. */
  urgent?: boolean;
}

/** Fallback destination for notifications that carry no explicit `screen`. */
export const CATEGORY_SCREEN: Record<NonNullable<InAppNotification['category']>, string | undefined> = {
  leak:          'leak',
  motion:        'motion',
  doors:         'doors',
  houseSecurity: 'doors',
  whoIsHome:     'whoshome',
  houseMode:     'home',
  push:          undefined,
  other:         undefined,
};
