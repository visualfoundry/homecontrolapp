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
  controlTypeClass:  string | null;
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
export interface SettingItem   { id: string; name: string }

export type SceneRoomTypeKey = 'bedroom' | 'bath' | 'living' | 'utility' | 'hall';
export type TimeOfDayKey = 'Morning' | 'Day' | 'Evening' | 'Night';
export type SceneSchedules = Record<SceneRoomTypeKey, Record<TimeOfDayKey, string>>;

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
  tvs: SettingItem[];
  irrigationPrograms: IrrigationProgram[];
  irrigationZones: IrrigationZone[];
  leakSensors: SensorDevice[];
  motionSensors: SensorDevice[];
  outdoorsPool: OutdoorDevice[];
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
