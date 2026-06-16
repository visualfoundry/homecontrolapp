// =============================================================================
// Mock catalog + seed state — Home Control App
// Ported from .claude/Claude Design/design_handoff_home_control/data.js
//
// MOCK_CONFIG  — catalog data (replaces WPGraphQL until CPTs/ACF are set up)
// buildInitialState() — builds the flat device state map from the catalog
//
// In M3, buildInitialState() output is replaced by GET /state from the
// home-control service. In M2 it seeds the store for static rendering.
// =============================================================================

import type {
  AppConfig,
  SceneConfig,
  PersonConfig,
  LightRoom,
  ExteriorDoor,
  InteriorSensor,
  ClimateZone,
  MusicZone,
  FanDevice,
  IrrigationProgram,
  IrrigationZone,
  SensorDevice,
  OutdoorDevice,
  SettingItem,
  SceneRoomConfig,
  SceneSchedules,
  FavGroup,
  LightSceneRoom,
} from '@/types/config';
import type { StateMap } from '@/types/state';

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

const scenes: SceneConfig[] = [
  { id: 'morning', name: 'Good Morning',  icon: 'sunrise', tint: '#F5A623', order: 0 },
  { id: 'away',    name: 'Away',          icon: 'away',    tint: '#5B7FE0', order: 1 },
  { id: 'movie',   name: 'Movie Night',   icon: 'film',    tint: '#9B5DE5', order: 2 },
  { id: 'dinner',  name: 'Dinner',        icon: 'dining',  tint: '#E07B53', order: 3 },
  { id: 'night',   name: 'Goodnight',     icon: 'moon',    tint: '#3A4A6B', order: 4 },
  { id: 'welcome', name: 'Welcome Home',  icon: 'home',    tint: '#34A853', order: 5 },
  { id: 'relax',   name: 'Relax',         icon: 'sun',     tint: '#E08A1E', order: 6 },
  { id: 'focus',   name: 'Focus',         icon: 'bulb',    tint: '#1E9E83', order: 7 },
  { id: 'party',   name: 'Party',         icon: 'bolt',    tint: '#9B5DE5', order: 8 },
  { id: 'reading', name: 'Reading',       icon: 'bulb',    tint: '#C0793F', order: 9 },
  { id: 'secure',  name: 'Lock Down',     icon: 'shield',  tint: '#E0483D', order: 10 },
];

const sceneDefault = ['morning', 'away', 'movie', 'dinner', 'night'];

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const people: PersonConfig[] = [
  { id: 'alex',     name: 'Alex'     },
  { id: 'greg',     name: 'Greg'     },
  { id: 'jeanette', name: 'Jeanette' },
  { id: 'laura',    name: 'Laura'    },
  { id: 'penny',    name: 'Penny'    },
  { id: 'visitor',  name: 'Visitor'  },
];

// ---------------------------------------------------------------------------
// Lights grouped by room
// ---------------------------------------------------------------------------

const lightRooms: LightRoom[] = [
  { room: 'Living Room',    lights: [
    { id: 'lr-main',  name: 'Main'       },
    { id: 'lr-art',   name: 'Art'        },
    { id: 'lr-chand', name: 'Chandelier' },
    { id: 'lr-sun',   name: 'Sun Room'   },
    { id: 'lr-table', name: 'Table'      },
  ]},
  { room: 'Kitchen',        lights: [
    { id: 'k-counters', name: 'Counters' },
    { id: 'k-island',   name: 'Island'   },
    { id: 'k-main',     name: 'Main'     },
    { id: 'k-sink',     name: 'Sink'     },
    { id: 'k-pantry',   name: 'Pantry'   },
  ]},
  { room: 'Dining Room',    lights: [
    { id: 'dr-chinese', name: 'Chinese Standing Lamp' },
    { id: 'dr-main',    name: 'Main'     },
    { id: 'dr-feature', name: 'Features' },
  ]},
  { room: 'Master Bedroom', lights: [
    { id: 'mb-lamp-bed', name: 'Lamp Bed'      },
    { id: 'mb-lamp-sit', name: 'Lamp Sitting'  },
    { id: 'mb-tv',       name: 'Lamp TV'       },
    { id: 'mb-main',     name: 'Main Bed'      },
    { id: 'mb-ceil',     name: 'Main Ceiling'  },
  ]},
  { room: 'Cinema',         lights: [
    { id: 'cin-screen', name: 'Screen'     },
    { id: 'cin-l',      name: 'Lamp Left'  },
    { id: 'cin-r',      name: 'Lamp Right' },
    { id: 'cin-main',   name: 'Main'       },
  ]},
  { room: 'Gym',            lights: [
    { id: 'gym-led',  name: 'Led'  },
    { id: 'gym-main', name: 'Main' },
  ]},
  { room: 'Library',        lights: [
    { id: 'lib-alc',  name: 'Lamp Alcove' },
    { id: 'lib-case', name: 'Lamp Case'   },
    { id: 'lib-main', name: 'Main'        },
  ]},
  { room: 'Studio',         lights: [
    { id: 'st-desk', name: 'Desk' },
    { id: 'st-door', name: 'Door' },
    { id: 'st-main', name: 'Main' },
  ]},
  { room: 'Sewing Room',    lights: [
    { id: 'sw-lamp', name: 'Lamp' },
    { id: 'sw-main', name: 'Main' },
  ]},
  { room: 'Hallways',       lights: [
    { id: 'hall-1', name: 'Level 1 Front' },
    { id: 'hall-2', name: 'Level 1 Rear'  },
    { id: 'hall-3', name: 'Level 2'       },
    { id: 'hall-4', name: 'Stairs'        },
  ]},
  { room: 'Guest Bedroom',  lights: [
    { id: 'gb-lamp', name: 'Lamp' },
    { id: 'gb-main', name: 'Main' },
  ]},
  { room: 'Laundry',        lights: [
    { id: 'la-main', name: 'Main' },
  ]},
];

// ---------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------

const doorsExterior: ExteriorDoor[] = [
  { id: 'd-backyard', name: 'Backyard'    },
  { id: 'd-driveway', name: 'Driveway'    },
  { id: 'd-front',    name: 'Front'       },
  { id: 'd-garage',   name: 'Garage'      },
  { id: 'd-livingrm', name: 'Living Room' },
  { id: 'd-porch',    name: 'Porch'       },
];

const doorsInterior: InteriorSensor[] = [
  { id: 'i-alex',    name: 'Alex Bedroom'    },
  { id: 'i-cinema',  name: 'Cinema'          },
  { id: 'i-guest',   name: 'Guest Room'      },
  { id: 'i-gym',     name: 'Gym'             },
  { id: 'i-laura',   name: 'Laura Bedroom'   },
  { id: 'i-library', name: 'Library'         },
  { id: 'i-master',  name: 'Master Bedroom'  },
  { id: 'i-sewing',  name: 'Sewing Room'     },
  { id: 'i-studio',  name: 'Studio'          },
];

// ---------------------------------------------------------------------------
// Climate
// ---------------------------------------------------------------------------

const climate: ClimateZone[] = [
  { id: 'cl-1',  name: 'Level 1'        },
  { id: 'cl-2',  name: 'Level 2'        },
  { id: 'cl-2c', name: 'Level 2 Cinema' },
  { id: 'cl-3',  name: 'Level 3'        },
];

// ---------------------------------------------------------------------------
// Music
// ---------------------------------------------------------------------------

const musicZones: MusicZone[] = [
  { id: 'm-dining',  name: 'Dining Room' },
  { id: 'm-kitchen', name: 'Kitchen'     },
  { id: 'm-library', name: 'Library'     },
  { id: 'm-living',  name: 'Living Room' },
  { id: 'm-pergola', name: 'Pergola'     },
];

// ---------------------------------------------------------------------------
// Fans
// ---------------------------------------------------------------------------

const FAN_NAMES = [
  'Alex Room', 'Guest Room', 'Gym', 'Library', 'Living Room',
  'Master Room Bed', 'Master Room Sitting', 'Pergola', 'Porch', 'Sewing Room', 'Studio',
];
const fans: FanDevice[] = FAN_NAMES.map((name, i) => ({ id: `fan-${i}`, name }));

// ---------------------------------------------------------------------------
// TVs
// ---------------------------------------------------------------------------

const tvs: SettingItem[] = [
  { id: 'tv-cinema',  name: 'Cinema TV'          },
  { id: 'tv-gym',     name: 'Gym TV'             },
  { id: 'tv-living',  name: 'Living Room TV'     },
  { id: 'tv-master',  name: 'Master Bedroom TV'  },
];

// ---------------------------------------------------------------------------
// Irrigation
// ---------------------------------------------------------------------------

const irrigationPrograms: IrrigationProgram[] = [
  { id: 'ip-all',    name: 'All Areas'      },
  { id: 'ip-garden', name: 'Garden Areas'   },
  { id: 'ip-back',   name: 'Lawn Area Back' },
  { id: 'ip-lawn',   name: 'Lawn Areas'     },
];

const irrigationZones: IrrigationZone[] = [
  { id: 'iz-bg',  name: 'Back Garden'      },
  { id: 'iz-blm', name: 'Back Lawn Middle' },
  { id: 'iz-blp', name: 'Back Lawn Pool'   },
  { id: 'iz-blt', name: 'Back Lawn Top'    },
  { id: 'iz-fg',  name: 'Front Garden'     },
  { id: 'iz-fl',  name: 'Front Lawn'       },
];

// ---------------------------------------------------------------------------
// Sensors
// ---------------------------------------------------------------------------

const LEAK_NAMES = [
  'Alex Bathroom', 'Guest Bathroom', 'HVAC Level 2 Cinema', 'HVAC Level 2', 'HVAC Level 3',
  'Kitchen', 'Laundry', 'Laura Bathroom', 'Master Bathroom Greg', 'Master Bathroom Jeanette', 'Powder Room',
];
const leakSensors: SensorDevice[] = LEAK_NAMES.map((name, i) => ({ id: `leak-${i}`, name }));

const MOTION_NAMES = [
  'Alex Bedroom', 'Cinema', 'Dining Room', 'Driveway', 'Front Door', 'Garage Inner', 'Garage Outer',
  'Guest Bathroom', 'Guest Bedroom', 'Gym', 'Hallways Front Door', 'Hallways Laundry',
  'Kitchen', 'Kitchen Pantry', 'Laundry', 'Laura Bedroom', 'Library', 'Living Room',
  'Master Bathroom', 'Master Bedroom', 'Mud Room', 'Pergola', 'Porch', 'Powder Room', 'Sewing Room', 'Studio',
];
const motionSensors: SensorDevice[] = MOTION_NAMES.map((name, i) => ({ id: `mo-${i}`, name }));

// ---------------------------------------------------------------------------
// Outdoors
// ---------------------------------------------------------------------------

const outdoorsPool: OutdoorDevice[] = [
  { id: 'op-light',  name: 'Light',          kind: 'toggle' },
  { id: 'op-fall',   name: 'Waterfall',      kind: 'toggle' },
  { id: 'op-falllt', name: 'Waterfall Light',kind: 'toggle' },
];

const outdoorsBackyard: OutdoorDevice[] = [
  { id: 'ob-pergola-l', name: 'Pergola Light', kind: 'dimmer' },
  { id: 'ob-pergola-f', name: 'Pergola Fan',   kind: 'toggle' },
  { id: 'ob-garden',    name: 'Garden Lights', kind: 'toggle' },
  { id: 'ob-feature',   name: 'Water Feature', kind: 'toggle' },
];

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const settingsSecurity: SettingItem[] = [
  { id: 's-home-alex',  name: 'At Home Alex'      },
  { id: 's-home-greg',  name: 'At Home Greg'      },
  { id: 's-home-jea',   name: 'At Home Jeanette'  },
  { id: 's-home-laura', name: 'At Home Laura'     },
  { id: 's-home-penny', name: 'At Home Penny'     },
  { id: 's-home-vis',   name: 'At Home Visitor'   },
  { id: 's-everyone',   name: 'Everyone Away'     },
  { id: 's-house',      name: 'House Security'    },
  { id: 's-water',      name: 'Water Mains'       },
];

const settingsEnvironment: SettingItem[] = [
  { id: 'e-amb-ext', name: 'Ambient Light Low Exterior' },
  { id: 'e-amb-int', name: 'Ambient Light Low Interior' },
  { id: 'e-cin-scr',    name: 'Cinema Screen Down'    },
  { id: 'e-cin-tv',    name: 'Cinema TV On'          },
  { id: 'e-cin-shades', name: 'Cinema Shades Down'   },
  { id: 'e-lr-tv',   name: 'Living Room TV On'          },
  { id: 'e-cold',    name: 'Outside Cold (<45°)'        },
  { id: 'e-freeze',  name: 'Outside Freezing (<34°)'    },
  { id: 'e-hot',     name: 'Outside Hot (>80°)'         },
  { id: 'e-winter',  name: 'Season Is Winter'           },
  { id: 'e-feature', name: 'Water Feature On'           },
];

const settingsSchedules: SettingItem[] = [
  { id: 'sc-fans',     name: 'Enable Auto Fans'   },
  { id: 'sc-holiday',  name: 'Holiday'            },
  { id: 'sc-irr',      name: 'Irrigation'         },
  { id: 'sc-irr-skip', name: 'Irrigation Skip Today' },
  { id: 'sc-fridge',   name: 'Outdoor Bar Fridge' },
  { id: 'sc-in',       name: 'Seasonal Indoor'    },
  { id: 'sc-out',      name: 'Seasonal Outdoor'   },
  { id: 'sc-water',    name: 'Water Feature'      },
];

const settingsHouse: SettingItem[] = [
  { id: 'h-guest',   name: 'Guest Mode'        },
  { id: 'h-eco',     name: 'Eco Mode'          },
  { id: 'h-quiet',   name: 'Quiet Hours'       },
];

// Garage doors are exterior-door locks (shared id with doorsExterior 'Garage').
const garageDoors: ExteriorDoor[] = [
  { id: 'd-garage',  name: 'Garage'            },
];

// Garage car doors are open/closed (illuminated when open) — separate from the lock.
const garageCarDoors: SettingItem[] = [
  { id: 'g-car-1',   name: 'Garage Car Door 1' },
  { id: 'g-car-2',   name: 'Garage Car Door 2' },
];

const garage: SettingItem[] = [
  { id: 'g-lights',  name: 'Garage Lights'     },
  { id: 'g-heater',  name: 'Garage Heater'     },
];

// Cars — controls with 'Car At Home' in the title.
const garageCars: SettingItem[] = [
  { id: 'car-greg',  name: 'Car At Home Greg'  },
  { id: 'car-laura', name: 'Car At Home Laura' },
];

// ---------------------------------------------------------------------------
// Scene rooms + schedule names
// ---------------------------------------------------------------------------

const sceneRooms: SceneRoomConfig[] = [
  { id: 'alex',    name: 'Alex Bedroom',   type: 'bedroom', hasDoor: true,  hasNightDim: true,  steps: 3, place: 'Alex Bedroom'   },
  { id: 'master',  name: 'Master Bedroom', type: 'bedroom', hasDoor: true,  hasNightDim: true,  steps: 4, place: 'Master Bedroom' },
  { id: 'guest',   name: 'Guest Bedroom',  type: 'bedroom', hasDoor: true,  hasNightDim: true,  steps: 3, place: 'Guest Bedroom'  },
  { id: 'gbath',   name: 'Guest Bathroom', type: 'bath',    hasDoor: true,  hasNightDim: true,  steps: 2, place: 'Guest Bathroom' },
  { id: 'kitchen', name: 'Kitchen',        type: 'living',  hasDoor: false, hasNightDim: false, steps: 5, place: 'Kitchen'        },
  { id: 'dining',  name: 'Dining Room',    type: 'living',  hasDoor: true,  hasNightDim: false, steps: 3, place: 'Dining Room'    },
  { id: 'library', name: 'Library',        type: 'living',  hasDoor: true,  hasNightDim: false, steps: 4, place: 'Library'        },
  { id: 'cinema',  name: 'Cinema',         type: 'living',  hasDoor: true,  hasNightDim: false, steps: 6, place: 'Cinema'         },
  { id: 'gym',     name: 'Gym',            type: 'utility', hasDoor: true,  hasNightDim: false, steps: 3, place: 'Gym'            },
  { id: 'studio',  name: 'Studio',         type: 'utility', hasDoor: true,  hasNightDim: false, steps: 3, place: 'Studio'         },
  { id: 'hall',    name: 'Hallways',       type: 'hall',    hasDoor: false, hasNightDim: false, steps: 2, place: 'Hallways'       },
  { id: 'laundry', name: 'Laundry',        type: 'utility', hasDoor: true,  hasNightDim: false, steps: 3, place: 'Laundry'        },
  { id: 'garage',  name: 'Garage',         type: 'utility', hasDoor: false, hasNightDim: false, steps: 2, place: 'Garage'         },
];

// Mock light scene rooms — mirrors sceneRooms, carrying the same step count.
const lightSceneRooms: LightSceneRoom[] = sceneRooms
  .map(r => ({ id: r.id, name: r.name, steps: r.steps ?? 3 }))
  .sort((a, b) => a.name.localeCompare(b.name));

const sceneSchedules: SceneSchedules = {
  bedroom: { Morning: 'Wake Up',        Day: 'Off',      Evening: 'Relax',        Night: 'Night-light'     },
  bath:    { Morning: 'Bright',         Day: 'Auto',     Evening: 'Warm',         Night: 'Dim Night-light' },
  living:  { Morning: 'Morning Bright', Day: 'Daylight', Evening: 'Warm Evening', Night: 'Path Dim'        },
  utility: { Morning: 'Bright',         Day: 'Bright',   Evening: 'Bright',       Night: 'Low'             },
  hall:    { Morning: 'Bright',         Day: 'Off',      Evening: 'Warm',         Night: 'Night Path'      },
};

// ---------------------------------------------------------------------------
// Favorites catalog
// ---------------------------------------------------------------------------

const favorites = ['lr-chand', 'd-front', 'k-main', 'm-living', 'ob-garden', 'fan-4'];

const favCatalog: FavGroup[] = [
  { group: 'Lights', items: [
    { id: 'lr-chand',     icon: 'bulb',      label: 'Living Room'    },
    { id: 'lr-main',      icon: 'bulb',      label: 'Living Room Main'},
    { id: 'k-main',       icon: 'bulb',      label: 'Kitchen'        },
    { id: 'dr-main',      icon: 'bulb',      label: 'Dining Room'    },
    { id: 'mb-main',      icon: 'bulb',      label: 'Master Bedroom' },
    { id: 'cin-screen',   icon: 'film',      label: 'Cinema Screen'  },
    { id: 'st-desk',      icon: 'bulb',      label: 'Studio Desk'    },
    { id: 'gym-led',      icon: 'bulb',      label: 'Gym LED'        },
  ]},
  { group: 'Doors', items: [
    { id: 'd-front',      icon: 'lock',      label: 'Front Door'     },
    { id: 'd-garage',     icon: 'lock',      label: 'Garage'         },
    { id: 'd-backyard',   icon: 'lock',      label: 'Backyard'       },
    { id: 'd-porch',      icon: 'lock',      label: 'Porch'          },
  ]},
  { group: 'Garage Doors', items: [
    { id: 'g-car-1',      icon: 'garage',    label: 'Garage Car Door 1' },
    { id: 'g-car-2',      icon: 'garage',    label: 'Garage Car Door 2' },
  ]},
  { group: 'Music', items: [
    { id: 'm-living',     icon: 'speaker',   label: 'Music'          },
    { id: 'm-kitchen',    icon: 'speaker',   label: 'Kitchen Music'  },
    { id: 'm-pergola',    icon: 'speaker',   label: 'Pergola Music'  },
  ]},
  { group: 'Fans', items: [
    { id: 'fan-4',        icon: 'fan',       label: 'Living Room Fan'},
    { id: 'fan-2',        icon: 'fan',       label: 'Gym Fan'        },
    { id: 'fan-7',        icon: 'fan',       label: 'Pergola Fan'    },
  ]},
  { group: 'TV', items: [
    { id: 'tv-living',    icon: 'tv',        label: 'Living Room TV' },
    { id: 'tv-master',    icon: 'tv',        label: 'Master Bedroom' },
    { id: 'tv-cinema',    icon: 'tv',        label: 'Cinema TV'      },
    { id: 'tv-gym',       icon: 'tv',        label: 'Gym TV'         },
  ]},
  { group: 'Outdoor', items: [
    { id: 'ob-garden',    icon: 'grass',     label: 'Garden Lights'  },
    { id: 'ob-feature',   icon: 'waterfall', label: 'Water Feature'  },
    { id: 'op-fall',      icon: 'waterfall', label: 'Pool Waterfall' },
    { id: 'ob-pergola-l', icon: 'bulb',      label: 'Pergola Light'  },
  ]},
  { group: 'Cinema', items: [
    { id: 'e-cin-tv',     icon: 'grid',      label: 'Theatre'        },
    { id: 'e-cin-scr',    icon: 'chevDown',  label: 'Screen Down'    },
    { id: 'e-cin-shades', icon: 'shades',    label: 'Window Shades'  },
  ]},
  { group: 'Scenes', items: lightSceneRooms.map(r => ({ id: r.id, icon: 'bulb' as const, label: r.name })) },
];

// ---------------------------------------------------------------------------
// The full mock config
// ---------------------------------------------------------------------------

export const MOCK_CONFIG: AppConfig = {
  scenes,
  sceneDefault,
  people,
  lightRooms,
  doorsExterior,
  doorsInterior,
  climate,
  musicZones,
  fans,
  tvs,
  irrigationPrograms,
  irrigationZones,
  leakSensors,
  motionSensors,
  outdoorsPool,
  outdoorsBackyard,
  whoIsHome: settingsSecurity.filter(s => /at home/i.test(s.name)),
  settingsSecurity,
  settingsEnvironment,
  settingsSchedules,
  settingsHouse,
  garage,
  garageDoors,
  garageCarDoors,
  garageCars,
  garageSceneId: 'garage',
  sceneRooms,
  lightSceneRooms,
  sceneSchedules,
  favorites,
  favCatalog,
  // Device id → place. Lights resolve via lightRooms; this covers the other
  // device classes shown on per-place room pages (best-effort for mock).
  controlPlaces: {
    'm-dining': 'Dining Room', 'm-kitchen': 'Kitchen', 'm-library': 'Library',
    'm-living': 'Living Room', 'm-pergola': 'Pergola',
    'g-car-1': 'Garage', 'g-car-2': 'Garage',
  },
  // Mock keys already match config ids, so no translation needed in mock mode.
  controlStateIds: {},
  weatherTempId: 'wx-temp',
  weatherHighId: 'wx-high',
  weatherLowId: 'wx-low',
  weatherCondId: 'wx-cond',
  houseStatusId: 'hs-status',
  houseClimateId: null,
  environmentalControls: [],
  poolNodeId:      null,
  poolTempId:      'pool-temp',
  poolPumpId:      'pool-pump',
  poolPumpOnOffId:      'pool-pump-onoff',
  poolHeaterId:         'pool-heater',
  poolHeaterSetpointId: 'pool-heater-setpoint',
  poolSalinatorId:      'pool-salinator',
  poolChlorinatorId:    null,
};

// ---------------------------------------------------------------------------
// buildInitialState — seed the flat device state map from catalog data.
// In M3 this is replaced by GET /state from the home-control service.
// ---------------------------------------------------------------------------

export function buildInitialState(): StateMap {
  const s: StateMap = {};

  // Lights (seed on/level from original data.js values)
  const lightSeed: Record<string, { on: boolean; level: number }> = {
    'lr-main': { on: true,  level: 55  }, 'lr-art':   { on: true,  level: 100 },
    'lr-chand':{ on: true,  level: 90  }, 'lr-sun':   { on: true,  level: 70  },
    'lr-table':{ on: true,  level: 100 }, 'gym-led':  { on: true,  level: 100 },
    'st-desk': { on: true,  level: 100 }, 'st-door':  { on: true,  level: 100 },
    'sw-lamp': { on: true,  level: 100 }, 'sw-main':  { on: true,  level: 90  },
  };
  lightRooms.forEach(r => r.lights.forEach(l => {
    s[l.id] = lightSeed[l.id] ?? { on: false, level: 0 };
  }));

  // Exterior doors
  // Door Exterior variables: value 1 = locked, value 0 = unlocked
  const doorSeed: Record<string, number> = {
    'd-backyard': 1, 'd-driveway': 1, 'd-front': 1,
    'd-garage': 0,   'd-livingrm': 1, 'd-porch': 1,
  };
  doorsExterior.forEach(d => { s[d.id] = { value: doorSeed[d.id] ?? 1 }; });

  // Interior sensors
  const sensorSeed: Record<string, { open: boolean; lowBattery?: boolean }> = {
    'i-cinema': { open: true }, 'i-guest': { open: true, lowBattery: true },
    'i-laura':  { open: true }, 'i-master':{ open: true }, 'i-sewing': { open: true },
    'i-studio': { open: true },
  };
  doorsInterior.forEach(d => { s[d.id] = sensorSeed[d.id] ?? { open: false }; });

  // Climate
  const climateSeed: Record<string, { temp: number; mode: 'heat' | 'cool' | 'auto' | 'off'; lo: number; hi: number }> = {
    'cl-1':  { temp: 71.5, mode: 'auto', lo: 60, hi: 74 },
    'cl-2':  { temp: 72.5, mode: 'auto', lo: 60, hi: 74 },
    'cl-2c': { temp: 71.5, mode: 'auto', lo: 60, hi: 74 },
    'cl-3':  { temp: 74.0, mode: 'cool', lo: 60, hi: 73 },
  };
  climate.forEach(c => { s[c.id] = climateSeed[c.id] ?? { temp: 72, mode: 'auto', lo: 60, hi: 74 }; });

  // Music
  musicZones.forEach(m => {
    s[m.id] = m.id === 'm-living' ? { on: true, vol: 34 } : { on: false, vol: 0 };
  });

  // Fans
  fans.forEach((f, i) => {
    s[f.id] = i === 4 ? { on: true, speed: 2 } : { on: false, speed: 0 };
  });

  // TVs
  tvs.forEach(t => { s[t.id] = { on: false }; });

  // Irrigation
  irrigationPrograms.forEach(p => { s[p.id] = { on: false }; });
  const zoneSeed: Record<string, number> = {
    'iz-bg': 20, 'iz-blm': 0.5, 'iz-blp': 2, 'iz-blt': 5, 'iz-fg': 20, 'iz-fl': 5,
  };
  irrigationZones.forEach(z => { s[z.id] = { mins: zoneSeed[z.id] ?? 10 }; });

  // Sensors
  leakSensors.forEach(l => { s[l.id] = { wet: false }; });
  motionSensors.forEach((m, i) => {
    s[m.id] = { motion: i === 17 || i === 24, lowBattery: i === 21 };
  });

  // Outdoors
  outdoorsPool.forEach(o => { s[o.id] = { on: false }; });
  outdoorsBackyard.forEach(o => {
    s[o.id] = o.kind === 'dimmer' ? { on: false, level: 0 } : { on: false };
  });
  s['ob-autolock'] = { on: true };

  // Settings
  const secSeed: Record<string, boolean> = {
    's-home-alex': true, 's-home-greg': true, 's-home-jea': true,
    's-home-penny': true, 's-home-vis': true, 's-water': true,
  };
  settingsSecurity.forEach(s_ => { s[s_.id] = { on: secSeed[s_.id] ?? false }; });

  const envSeed: Record<string, boolean> = {
    'e-amb-int': true, 'e-lr-tv': true, 'e-feature': true,
  };
  settingsEnvironment.forEach(e => { s[e.id] = { on: envSeed[e.id] ?? false }; });

  const schSeed: Record<string, boolean> = {
    'sc-irr': true, 'sc-fridge': true, 'sc-water': true,
  };
  settingsSchedules.forEach(sc => { s[sc.id] = { on: schSeed[sc.id] ?? false }; });

  const houseSeed: Record<string, boolean> = {
    'h-eco': true,
  };
  settingsHouse.forEach(h => { s[h.id] = { on: houseSeed[h.id] ?? false }; });

  // House Status variable — value 1=Morning, 2=Day, 3=Evening, 4=Night
  s['hs-status'] = { value: 2 };

  const garageSeed: Record<string, boolean> = {
    'g-lights': true,
  };
  garage.forEach(g => { s[g.id] = { on: garageSeed[g.id] ?? false }; });
  // Garage doors share ids with doorsExterior (seeded above as LockState).

  // Cars — 'Car At Home' presence flags
  const carSeed: Record<string, boolean> = {
    'car-greg': true,
  };
  garageCars.forEach(c => { s[c.id] = { on: carSeed[c.id] ?? false }; });

  // Garage car doors — open/closed contact state
  const garageCarSeed: Record<string, boolean> = {
    'g-car-1': true,
  };
  garageCarDoors.forEach(d => { s[d.id] = { open: garageCarSeed[d.id] ?? false }; });

  // Pool real hardware controls (backed by WP controls / poolPumpId, poolHeaterId, poolSalinatorId)
  s['pool-temp']       = { value: 81 };
  s['pool-pump']       = { value: 65 }; // 0=off, 35-100=speed%
  s['pool-pump-onoff']        = { value: 1 };  // 0=off, 1=on
  s['pool-heater']            = { value: 0 };  // 0=off, 1=on
  s['pool-heater-setpoint']   = { value: 86 }; // °F, 60-95
  s['pool-salinator']  = { on: true };

  // Pool composite (OmniLogic mock — will be replaced by real adapter)
  s['pool'] = {
    pumpOn: true, pumpSpeed: 65,
    heaterOn: false, heaterRunning: false, poolTemp: 81, heaterTarget: 84,
    ph: 7.4, phTarget: 7.6,
    chlorinatorOn: true, orpSet: 715, orpNow: 702, saltPPM: 3200,
    pumpSchedules: [
      { id: 'ps1', enabled: true,  start: '06:00', end: '10:00', speed: 65,  days: [true,true,true,true,true,true,true] },
      { id: 'ps2', enabled: true,  start: '18:00', end: '20:30', speed: 100, days: [false,true,false,true,false,true,false] },
      { id: 'ps3', enabled: false, start: '22:00', end: '23:30', speed: 30,  days: [true,false,false,false,false,false,true] },
    ],
    heaterSchedules: [
      { id: 'hs1', enabled: true, start: '07:00', end: '09:00', target: 86, days: [true,false,false,false,false,false,true] },
    ],
  };

  // Presence (geolocation flags — same shape as EISY flag variables)
  const homeSeed: Record<string, boolean> = {
    alex: true, greg: true, jeanette: true, penny: true, visitor: true,
  };
  people.forEach(p => { s[p.id] = { on: homeSeed[p.id] ?? false }; });

  // Weather variables (hub variables)
  s['wx-temp'] = { value: 70 };
  s['wx-high'] = { value: 77 };
  s['wx-low']  = { value: 58 };
  s['wx-cond'] = { text: 'Clear' };

  // Global
  s['_global'] = { timeOfDay: 'Day', weather: 'Clear' };

  // Prefs (seeded, overridden by user prefs in store)
  s['_favs']   = { ids: [...favorites] };
  s['_scenes'] = { ids: [...sceneDefault] };

  // Automation (scene engine)
  const autoSeed: Record<string, { automated: boolean; motion: boolean; doorOpen: boolean; manual: boolean; nightDim: boolean; intensity: number }> = {
    alex:    { automated: true,  motion: false, doorOpen: true,  manual: false, nightDim: true,  intensity: 65  },
    master:  { automated: true,  motion: false, doorOpen: false, manual: false, nightDim: true,  intensity: 40  },
    guest:   { automated: false, motion: false, doorOpen: true,  manual: false, nightDim: false, intensity: 0   },
    gbath:   { automated: true,  motion: true,  doorOpen: true,  manual: false, nightDim: true,  intensity: 80  },
    kitchen: { automated: true,  motion: true,  doorOpen: true,  manual: false, nightDim: false, intensity: 90  },
    dining:  { automated: true,  motion: false, doorOpen: true,  manual: true,  nightDim: false, intensity: 55  },
    library: { automated: true,  motion: false, doorOpen: true,  manual: false, nightDim: false, intensity: 60  },
    cinema:  { automated: true,  motion: false, doorOpen: false, manual: false, nightDim: false, intensity: 25  },
    gym:     { automated: true,  motion: false, doorOpen: true,  manual: false, nightDim: false, intensity: 100 },
    studio:  { automated: true,  motion: false, doorOpen: true,  manual: true,  nightDim: false, intensity: 75  },
    hall:    { automated: true,  motion: true,  doorOpen: true,  manual: false, nightDim: false, intensity: 45  },
    laundry: { automated: false, motion: false, doorOpen: true,  manual: false, nightDim: false, intensity: 70  },
  };
  sceneRooms.forEach(r => { s[`auto:${r.id}`] = autoSeed[r.id] ?? { automated: true, motion: false, doorOpen: false, manual: false, nightDim: false, intensity: 50 }; });

  return s;
}
