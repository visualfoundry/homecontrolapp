/* data.js — Home Control device model (real names from the existing site).
   Attaches window.HC with device lists + seeded initial states. */
(function () {
  // ---- Scenes (one-tap routines) ----
  const scenes = [
    { id: 'morning', name: 'Good Morning', icon: 'sunrise', tint: '#F5A623' },
    { id: 'away',    name: 'Away',         icon: 'away',    tint: '#5B7FE0' },
    { id: 'movie',   name: 'Movie Night',  icon: 'film',    tint: '#9B5DE5' },
    { id: 'dinner',  name: 'Dinner',       icon: 'dining',  tint: '#E07B53' },
    { id: 'night',   name: 'Goodnight',    icon: 'moon',    tint: '#3A4A6B' },
    { id: 'welcome', name: 'Welcome Home', icon: 'home',    tint: '#34A853' },
    { id: 'relax',   name: 'Relax',        icon: 'sun',     tint: '#E08A1E' },
    { id: 'focus',   name: 'Focus',        icon: 'bulb',    tint: '#1E9E83' },
    { id: 'party',   name: 'Party',        icon: 'bolt',    tint: '#9B5DE5' },
    { id: 'reading', name: 'Reading',      icon: 'bulb',    tint: '#c0793f' },
    { id: 'secure',  name: 'Lock Down',    icon: 'shield',  tint: '#E0483D' },
  ];
  // Scenes shown on the Home dashboard by default (the rest are addable via Edit)
  const sceneDefault = ['morning', 'away', 'movie', 'dinner', 'night'];

  // ---- People ----
  const people = [
    { id: 'alex',     name: 'Alex',     home: true,  car: true  },
    { id: 'greg',     name: 'Greg',     home: true,  car: true  },
    { id: 'jeanette', name: 'Jeanette', home: true,  car: true  },
    { id: 'laura',    name: 'Laura',    home: false, car: false },
    { id: 'penny',    name: 'Penny',    home: true,  car: false },
    { id: 'visitor',  name: 'Visitor',  home: true,  car: false },
  ];

  // ---- Lights, grouped by room ----
  const lightRooms = [
    { room: 'Living Room', lights: [
      { id: 'lr-main',  name: 'Main',          on: true,  level: 55  },
      { id: 'lr-art',   name: 'Art',           on: true,  level: 100 },
      { id: 'lr-chand', name: 'Chandelier',    on: true,  level: 90  },
      { id: 'lr-sun',   name: 'Sun Room',      on: true,  level: 70  },
      { id: 'lr-table', name: 'Table',         on: true,  level: 100 },
    ]},
    { room: 'Kitchen', lights: [
      { id: 'k-counters', name: 'Counters', on: false, level: 0 },
      { id: 'k-island',   name: 'Island',   on: false, level: 0 },
      { id: 'k-main',     name: 'Main',      on: false, level: 0 },
      { id: 'k-sink',     name: 'Sink',      on: false, level: 0 },
      { id: 'k-pantry',   name: 'Pantry',    on: false, level: 0 },
    ]},
    { room: 'Dining Room', lights: [
      { id: 'dr-chinese', name: 'Chinese Standing Lamp', on: false, level: 0 },
      { id: 'dr-main',    name: 'Main',     on: false, level: 0 },
      { id: 'dr-feature', name: 'Features', on: false, level: 0 },
    ]},
    { room: 'Master Bedroom', lights: [
      { id: 'mb-lamp-bed', name: 'Lamp Bed',  on: false, level: 0 },
      { id: 'mb-lamp-sit', name: 'Lamp Sitting', on: false, level: 0 },
      { id: 'mb-tv',       name: 'Lamp TV',   on: false, level: 0 },
      { id: 'mb-main',     name: 'Main Bed',  on: false, level: 0 },
      { id: 'mb-ceil',     name: 'Main Ceiling', on: false, level: 0 },
    ]},
    { room: 'Cinema', lights: [
      { id: 'cin-screen', name: 'Screen', on: false, level: 0 },
      { id: 'cin-l',      name: 'Lamp Left',  on: false, level: 0 },
      { id: 'cin-r',      name: 'Lamp Right', on: false, level: 0 },
      { id: 'cin-main',   name: 'Main',  on: false, level: 0 },
    ]},
    { room: 'Gym', lights: [
      { id: 'gym-led',  name: 'Led',  on: true,  level: 100 },
      { id: 'gym-main', name: 'Main', on: false, level: 0 },
    ]},
    { room: 'Library', lights: [
      { id: 'lib-alc',  name: 'Lamp Alcove', on: false, level: 0 },
      { id: 'lib-case', name: 'Lamp Case',   on: false, level: 0 },
      { id: 'lib-main', name: 'Main',        on: false, level: 0 },
    ]},
    { room: 'Studio', lights: [
      { id: 'st-desk', name: 'Desk', on: true, level: 100 },
      { id: 'st-door', name: 'Door', on: true, level: 100 },
      { id: 'st-main', name: 'Main', on: false, level: 0 },
    ]},
    { room: 'Sewing Room', lights: [
      { id: 'sw-lamp', name: 'Lamp', on: true, level: 100 },
      { id: 'sw-main', name: 'Main', on: true, level: 90 },
    ]},
    { room: 'Hallways', lights: [
      { id: 'hall-1', name: 'Level 1 Front', on: false, level: 0 },
      { id: 'hall-2', name: 'Level 1 Rear',  on: false, level: 0 },
      { id: 'hall-3', name: 'Level 2',       on: false, level: 0 },
      { id: 'hall-4', name: 'Stairs',        on: false, level: 0 },
    ]},
    { room: 'Guest Bedroom', lights: [
      { id: 'gb-lamp', name: 'Lamp', on: false, level: 0 },
      { id: 'gb-main', name: 'Main', on: false, level: 0 },
    ]},
    { room: 'Laundry', lights: [
      { id: 'la-main', name: 'Main', on: false, level: 0 },
    ]},
  ];

  // ---- Doors ----
  const doorsExterior = [
    { id: 'd-backyard', name: 'Backyard',   locked: true  },
    { id: 'd-driveway', name: 'Driveway',   locked: true  },
    { id: 'd-front',    name: 'Front',      locked: true  },
    { id: 'd-garage',   name: 'Garage',     locked: false },
    { id: 'd-livingrm', name: 'Living Room', locked: true },
    { id: 'd-porch',    name: 'Porch',      locked: true  },
  ];
  const doorsInterior = [
    { id: 'i-alex',   name: 'Alex Bedroom',  open: false },
    { id: 'i-cinema', name: 'Cinema',        open: true  },
    { id: 'i-guest',  name: 'Guest Room',    open: true, lowBattery: true },
    { id: 'i-gym',    name: 'Gym',           open: false },
    { id: 'i-laura',  name: 'Laura Bedroom', open: true  },
    { id: 'i-library',name: 'Library',       open: false },
    { id: 'i-master', name: 'Master Bedroom',open: true  },
    { id: 'i-sewing', name: 'Sewing Room',   open: true  },
    { id: 'i-studio', name: 'Studio',        open: true  },
  ];

  // ---- Climate zones ----
  const climate = [
    { id: 'cl-1',      name: 'Level 1',        temp: 71.5, mode: 'auto', lo: 60, hi: 74 },
    { id: 'cl-2',      name: 'Level 2',        temp: 72.5, mode: 'auto', lo: 60, hi: 74 },
    { id: 'cl-2c',     name: 'Level 2 Cinema', temp: 71.5, mode: 'auto', lo: 60, hi: 74 },
    { id: 'cl-3',      name: 'Level 3',        temp: 74.0, mode: 'cool', lo: 60, hi: 73 },
  ];

  // ---- Music zones ----
  const musicZones = [
    { id: 'm-dining',  name: 'Dining Room', on: false, vol: 0 },
    { id: 'm-kitchen', name: 'Kitchen',     on: false, vol: 0 },
    { id: 'm-library', name: 'Library',     on: false, vol: 0 },
    { id: 'm-living',  name: 'Living Room', on: true,  vol: 34 },
    { id: 'm-pergola', name: 'Pergola',     on: false, vol: 0 },
  ];

  // ---- Fans ----
  const fans = [
    'Alex Room','Guest Room','Gym','Library','Living Room',
    'Master Room Bed','Master Room Sitting','Pergola','Porch','Sewing Room','Studio',
  ].map((n, i) => ({ id: 'fan-' + i, name: n, on: n === 'Living Room', speed: n === 'Living Room' ? 2 : 0 }));

  // ---- Irrigation ----
  const irrigationPrograms = [
    { id: 'ip-all',    name: 'All Areas',     on: false },
    { id: 'ip-garden', name: 'Garden Areas',  on: false },
    { id: 'ip-back',   name: 'Lawn Area Back', on: false },
    { id: 'ip-lawn',   name: 'Lawn Areas',    on: false },
  ];
  const irrigationZones = [
    { id: 'iz-bg',  name: 'Back Garden',     mins: 20 },
    { id: 'iz-blm', name: 'Back Lawn Middle', mins: 0.5 },
    { id: 'iz-blp', name: 'Back Lawn Pool',  mins: 2 },
    { id: 'iz-blt', name: 'Back Lawn Top',   mins: 5 },
    { id: 'iz-fg',  name: 'Front Garden',    mins: 20 },
    { id: 'iz-fl',  name: 'Front Lawn',      mins: 5 },
  ];

  // ---- Leak sensors ----
  const leakSensors = [
    'Alex Bathroom','Guest Bathroom','HVAC Level 2 Cinema','HVAC Level 2','HVAC Level 3',
    'Kitchen','Laundry','Laura Bathroom','Master Bathroom Greg','Master Bathroom Jeanette','Powder Room',
  ].map((n, i) => ({ id: 'leak-' + i, name: n, wet: false }));

  // ---- Motion sensors ----
  const motionSensors = [
    'Alex Bedroom','Cinema','Dining Room','Driveway','Front Door','Garage Inner','Garage Outer',
    'Guest Bathroom','Guest Bedroom','Gym','Hallways Front Door','Hallways Laundry',
    'Kitchen','Kitchen Pantry','Laundry','Laura Bedroom','Library','Living Room',
    'Master Bathroom','Master Bedroom','Mud Room','Pergola','Porch','Powder Room','Sewing Room','Studio',
  ].map((n, i) => ({
    id: 'mo-' + i, name: n,
    motion: (n === 'Living Room' || n === 'Sewing Room'),
    lowBattery: (n === 'Pergola'),
  }));

  // ---- Outdoors ----
  const outdoorsPool = [
    { id: 'op-light',  name: 'Light',          on: false, kind: 'toggle' },
    { id: 'op-fall',   name: 'Waterfall',      on: false, kind: 'toggle' },
    { id: 'op-falllt', name: 'Waterfall Light', on: false, kind: 'toggle' },
  ];
  const outdoorsBackyard = [
    { id: 'ob-pergola-l', name: 'Pergola Light', on: false, level: 0, kind: 'dimmer' },
    { id: 'ob-pergola-f', name: 'Pergola Fan',   on: false, kind: 'toggle' },
    { id: 'ob-garden',    name: 'Garden Lights', on: false, kind: 'toggle' },
    { id: 'ob-feature',   name: 'Water Feature', on: false, kind: 'toggle' },
  ];

  // ---- Settings groups ----
  const settingsSecurity = [
    { id: 's-home-alex', name: 'At Home Alex', on: true },
    { id: 's-home-greg', name: 'At Home Greg', on: true },
    { id: 's-home-jea',  name: 'At Home Jeanette', on: true },
    { id: 's-home-laura',name: 'At Home Laura', on: false },
    { id: 's-home-penny',name: 'At Home Penny', on: true },
    { id: 's-home-vis',  name: 'At Home Visitor', on: true },
    { id: 's-everyone',  name: 'Everyone Away', on: false },
    { id: 's-house',     name: 'House Security', on: false },
    { id: 's-water',     name: 'Water Mains', on: true },
  ];
  const settingsEnvironment = [
    { id: 'e-amb-ext', name: 'Ambient Light Low Exterior', on: false },
    { id: 'e-amb-int', name: 'Ambient Light Low Interior', on: true },
    { id: 'e-cin-scr', name: 'Cinema Screen Down', on: false },
    { id: 'e-cin-tv',  name: 'Cinema Theatre', on: false },
    { id: 'e-cin-shades', name: 'Cinema Window Shades', on: false },
    { id: 'e-lr-tv',   name: 'Living Room TV On', on: true },
    { id: 'e-cold',    name: 'Outside Cold (<45°)', on: false },
    { id: 'e-freeze',  name: 'Outside Freezing (<34°)', on: false },
    { id: 'e-hot',     name: 'Outside Hot (>80°)', on: false },
    { id: 'e-winter',  name: 'Season Is Winter', on: false },
    { id: 'e-feature', name: 'Water Feature On', on: true },
  ];
  const settingsSchedules = [
    { id: 'sc-fans',   name: 'Enable Auto Fans', on: false },
    { id: 'sc-holiday',name: 'Holiday', on: false },
    { id: 'sc-irr',    name: 'Irrigation', on: true },
    { id: 'sc-irr-skip',name: 'Irrigation Skip Today', on: false },
    { id: 'sc-fridge', name: 'Outdoor Bar Fridge', on: true },
    { id: 'sc-in',     name: 'Seasonal Indoor', on: false },
    { id: 'sc-out',    name: 'Seasonal Outdoor', on: false },
    { id: 'sc-water',  name: 'Water Feature', on: true },
  ];

  // ---- Room automation / scenes ----
  // Each room runs standard scenes that change through the day and are
  // motion-activated. The per-room automation state is editable so stuck
  // sensors / indicators can be corrected by hand.
  const sceneRooms = [
    { id: 'alex',    name: 'Alex Bedroom',   type: 'bedroom', hasDoor: true,  hasNightDim: true  },
    { id: 'master',  name: 'Master Bedroom', type: 'bedroom', hasDoor: true,  hasNightDim: true  },
    { id: 'guest',   name: 'Guest Bedroom',  type: 'bedroom', hasDoor: true,  hasNightDim: true  },
    { id: 'gbath',   name: 'Guest Bathroom', type: 'bath',    hasDoor: true,  hasNightDim: true  },
    { id: 'kitchen', name: 'Kitchen',        type: 'living',  hasDoor: false, hasNightDim: false },
    { id: 'dining',  name: 'Dining Room',    type: 'living',  hasDoor: true,  hasNightDim: false },
    { id: 'library', name: 'Library',        type: 'living',  hasDoor: true,  hasNightDim: false },
    { id: 'cinema',  name: 'Cinema',         type: 'living',  hasDoor: true,  hasNightDim: false },
    { id: 'gym',     name: 'Gym',            type: 'utility', hasDoor: true,  hasNightDim: false },
    { id: 'studio',  name: 'Studio',         type: 'utility', hasDoor: true,  hasNightDim: false },
    { id: 'hall',    name: 'Hallways',       type: 'hall',    hasDoor: false, hasNightDim: false },
    { id: 'laundry', name: 'Laundry',        type: 'utility', hasDoor: true,  hasNightDim: false },
  ];
  // Standard scene per time-of-day, by room type (timeOfDay drives the active one).
  const sceneSchedules = {
    bedroom: { Morning: 'Wake Up',        Day: 'Off',      Evening: 'Relax',       Night: 'Night-light'    },
    bath:    { Morning: 'Bright',         Day: 'Auto',     Evening: 'Warm',        Night: 'Dim Night-light'},
    living:  { Morning: 'Morning Bright', Day: 'Daylight', Evening: 'Warm Evening',Night: 'Path Dim'       },
    utility: { Morning: 'Bright',         Day: 'Bright',   Evening: 'Bright',      Night: 'Low'            },
    hall:    { Morning: 'Bright',         Day: 'Off',      Evening: 'Warm',        Night: 'Night Path'     },
  };
  // Seeded automation state (variety shows every status: closed door, manual
  // override, motion active, automation off, night-dim on).
  // `intensity` = the aggregated scene brightness (0–100) for the room's lights.
  const sceneSeed = {
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

  // ---- Build flat initial state map ----
  const state = {};
  lightRooms.forEach(r => r.lights.forEach(l => state[l.id] = { on: l.on, level: l.level }));
  doorsExterior.forEach(d => state[d.id] = { locked: d.locked });
  doorsInterior.forEach(d => state[d.id] = { open: d.open });
  climate.forEach(c => state[c.id] = { temp: c.temp, mode: c.mode, lo: c.lo, hi: c.hi });
  musicZones.forEach(m => state[m.id] = { on: m.on, vol: m.vol });
  fans.forEach(f => state[f.id] = { on: f.on, speed: f.speed });
  irrigationPrograms.forEach(p => state[p.id] = { on: p.on });
  irrigationZones.forEach(z => state[z.id] = { mins: z.mins });
  leakSensors.forEach(s => state[s.id] = { wet: s.wet });
  motionSensors.forEach(s => state[s.id] = { motion: s.motion });
  people.forEach(p => state['person:' + p.id] = { home: p.home });
  [...outdoorsPool, ...outdoorsBackyard].forEach(o => state[o.id] = o.kind === 'dimmer' ? { on: o.on, level: o.level } : { on: o.on });
  [...settingsSecurity, ...settingsEnvironment, ...settingsSchedules].forEach(s => state[s.id] = { on: s.on });
  state['_global'] = { holiday: false, security: false, irrigationSchedule: true, timeOfDay: 'Day', weather: 'Clear' };
  state['ob-autolock'] = { on: true };

  // ---- Pool equipment ----
  state['pool'] = {
    pumpOn: true, pumpSpeed: 65,
    heaterOn: false, heaterRunning: false, poolTemp: 81, heaterTarget: 84,
    ph: 7.4, phTarget: 7.6,
    chlorinatorOn: true, orpSet: 715, orpNow: 702, saltPPM: 3200,
    pumpSchedules: [
      { id: 'ps1', enabled: true,  start: '06:00', end: '10:00', speed: 65, days: [true, true, true, true, true, true, true] },
      { id: 'ps2', enabled: true,  start: '18:00', end: '20:30', speed: 100, days: [false, true, false, true, false, true, false] },
      { id: 'ps3', enabled: false, start: '22:00', end: '23:30', speed: 30, days: [true, false, false, false, false, false, true] },
    ],
    heaterSchedules: [
      { id: 'hs1', enabled: true, start: '07:00', end: '09:00', target: 86, days: [true, false, false, false, false, false, true] },
    ],
  };

  // Favorites shown on the Home dashboard (device ids; 'scene:<roomId>' = a Room Scene)
  const favorites = ['scene:alex', 'lr-chand', 'd-front', 'k-main', 'm-living', 'ob-garden', 'fan-4', 'e-cin-tv', 'e-cin-scr', 'e-cin-shades'];

  // Catalog of devices that can be pinned to the Home dashboard as favorites.
  // Grouped for the Edit Favorites screen; icon + label drive the dashboard tile.
  const favCatalog = [
    { group: 'Lights', items: [
      { id: 'lr-chand',     icon: 'bulb', label: 'Living Room' },
      { id: 'lr-main',      icon: 'bulb', label: 'Living Room Main' },
      { id: 'k-main',       icon: 'bulb', label: 'Kitchen' },
      { id: 'dr-main',      icon: 'bulb', label: 'Dining Room' },
      { id: 'mb-main',      icon: 'bulb', label: 'Master Bedroom' },
      { id: 'cin-screen',   icon: 'film', label: 'Cinema Screen' },
      { id: 'st-desk',      icon: 'bulb', label: 'Studio Desk' },
      { id: 'gym-led',      icon: 'bulb', label: 'Gym LED' },
    ]},
    { group: 'Doors', items: [
      { id: 'd-front',      icon: 'lock', label: 'Front Door' },
      { id: 'd-garage',     icon: 'lock', label: 'Garage' },
      { id: 'd-backyard',   icon: 'lock', label: 'Backyard' },
      { id: 'd-porch',      icon: 'lock', label: 'Porch' },
    ]},
    { group: 'Music', items: [
      { id: 'm-living',     icon: 'speaker', label: 'Music' },
      { id: 'm-kitchen',    icon: 'speaker', label: 'Kitchen Music' },
      { id: 'm-pergola',    icon: 'speaker', label: 'Pergola Music' },
    ]},
    { group: 'Fans', items: [
      { id: 'fan-4',        icon: 'fan', label: 'Living Room Fan' },
      { id: 'fan-2',        icon: 'fan', label: 'Gym Fan' },
      { id: 'fan-7',        icon: 'fan', label: 'Pergola Fan' },
    ]},
    { group: 'Cinema', items: [
      { id: 'e-cin-tv',     icon: 'film',     label: 'Theatre' },
      { id: 'e-cin-scr',    icon: 'chevDown', label: 'Screen Down' },
      { id: 'e-cin-shades', icon: 'shades',   label: 'Window Shades', onLabel: 'Up', offLabel: 'Down' },
    ]},
    { group: 'Outdoor', items: [
      { id: 'ob-garden',    icon: 'grass', label: 'Garden Lights' },
      { id: 'ob-feature',   icon: 'waterfall', label: 'Water Feature' },
      { id: 'op-fall',      icon: 'waterfall', label: 'Pool Waterfall' },
      { id: 'ob-pergola-l', icon: 'bulb', label: 'Pergola Light' },
    ]},
    // Room Scenes are favoritable too — pinned as a compact automation tile.
    { group: 'Room Scenes', items: sceneRooms.map(r => ({ id: 'scene:' + r.id, icon: 'layers', label: r.name })) },
  ];
  state['_favs'] = { ids: favorites.slice() };
  state['_scenes'] = { ids: sceneDefault.slice() };
  sceneRooms.forEach(r => state['auto:' + r.id] = { ...sceneSeed[r.id] });

  window.HC = {
    scenes, people, lightRooms,
    doorsExterior, doorsInterior, climate, musicZones, fans,
    irrigationPrograms, irrigationZones, leakSensors, motionSensors,
    outdoorsPool, outdoorsBackyard,
    settingsSecurity, settingsEnvironment, settingsSchedules,
    initialState: state, favorites, favCatalog,
    sceneRooms, sceneSchedules,
  };
})();
