// =============================================================================
// Config model types — Home Control App
// Source of truth: .claude/config-contract.md
//
// Config is fetched from WordPress (WPGraphQL) at build/ISR time.
// These types mirror the GraphQL schema and design/data.js catalogs.
// =============================================================================

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
// Raw WPGraphQL response shape (Relay-style nodes wrappers, used by config.ts)
// ---------------------------------------------------------------------------

interface DeviceConfigRaw {
  id: string;
  name: string;
  class: DeviceClass;
  room: { node: { id: string } };
  icon: string;
  tint: string;
  order: number;
  meta?: DeviceMeta;
}

interface RoomConfigRaw {
  id: string;
  name: string;
  order: number;
  devices: { nodes: DeviceConfigRaw[] };
}

export interface HomeConfigRaw {
  rooms:      { nodes: RoomConfigRaw[] };
  scenes:     { nodes: SceneConfig[] };
  sceneRooms: { nodes: SceneRoomConfig[] };
  favCatalog: { groups: FavGroup[] };
  people:     { nodes: PersonConfig[] };
  layout:     LayoutConfig;
}

// ---------------------------------------------------------------------------
// Device catalog types (mirrors data.js structure, used by AppConfig)
// ---------------------------------------------------------------------------

export interface LightDevice   { id: string; name: string }
export interface LightRoom     { room: string; lights: LightDevice[] }
export interface ExteriorDoor  { id: string; name: string }
export interface InteriorSensor{ id: string; name: string }
export interface ClimateZone   { id: string; name: string }
export interface MusicZone     { id: string; name: string }
export interface FanDevice     { id: string; name: string }
export interface IrrigationProgram { id: string; name: string }
export interface IrrigationZone    { id: string; name: string }
export interface SensorDevice  { id: string; name: string }
export interface OutdoorDevice { id: string; name: string; kind: 'toggle' | 'dimmer' }
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
  people: PersonConfig[];
  lightRooms: LightRoom[];
  doorsExterior: ExteriorDoor[];
  doorsInterior: InteriorSensor[];
  climate: ClimateZone[];
  musicZones: MusicZone[];
  fans: FanDevice[];
  irrigationPrograms: IrrigationProgram[];
  irrigationZones: IrrigationZone[];
  leakSensors: SensorDevice[];
  motionSensors: SensorDevice[];
  outdoorsPool: OutdoorDevice[];
  outdoorsBackyard: OutdoorDevice[];
  settingsSecurity: SettingItem[];
  settingsEnvironment: SettingItem[];
  settingsSchedules: SettingItem[];
  sceneRooms: SceneRoomConfig[];
  sceneSchedules: SceneSchedules;
  favorites: string[];
  favCatalog: FavGroup[];
}

// ---------------------------------------------------------------------------
// User preferences (localStorage — not device state, not config)
// ---------------------------------------------------------------------------

export interface UserPrefs {
  theme: 'light' | 'dark';
  accent: string;
  radius: number;       // 10–30
  density: 'compact' | 'regular' | 'comfy';
  font: 'system' | 'rounded';
  tabs: string[];       // up to 4 section ids for the tab bar
}

export const DEFAULT_PREFS: UserPrefs = {
  theme: 'light',
  accent: '#E0483D',
  radius: 22,
  density: 'regular',
  font: 'system',
  tabs: ['home', 'lights', 'doors', 'climate'],
};
