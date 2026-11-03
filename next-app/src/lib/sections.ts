// =============================================================================
// Section registry — Home Control App
// Maps section id → display name, icon, tint color.
// Used by TabBar, MoreScreen, CustomizeScreen.
// Source: .claude/Claude Design/design_handoff_home_control/app.jsx
// =============================================================================

export interface SectionDef {
  name: string;
  icon: string;  // Icon name from Icon component
  tint: string;
}

/** All sections the app knows about. The tab bar shows up to MAX_TABS of these. */
export const SECTIONS: Record<string, SectionDef> = {
  home:       { name: 'Home',       icon: 'home',     tint: '#E0483D' },
  scenes:     { name: 'Scenes',     icon: 'layers',   tint: '#5B7FE0' },
  lights:     { name: 'Lights',     icon: 'bulb',     tint: '#F0A500' },
  doors:      { name: 'Doors',      icon: 'lock',     tint: '#34A853' },
  garage:     { name: 'Garage',     icon: 'garage',   tint: '#6E7B8F' },
  climate:    { name: 'Climate',    icon: 'thermo',   tint: '#E07B53' },
  pool:       { name: 'Pool',       icon: 'pool',     tint: '#2BB3A3' },
  music:      { name: 'Music',      icon: 'speaker',  tint: '#9B5DE5' },
  fans:       { name: 'Fans',       icon: 'fan',      tint: '#3D9BE0' },
  tv:         { name: 'TV',         icon: 'tv',       tint: '#1A7AC4' },
  outdoors:   { name: 'Outdoors',   icon: 'pergola',  tint: '#2BB3A3' },
  irrigation: { name: 'Irrigation', icon: 'grass',    tint: '#3FA535' },
  leak:       { name: 'Water Leak', icon: 'droplet',  tint: '#5A9BD4' },
  motion:     { name: 'Motion',     icon: 'motion',   tint: '#E0483D' },
  cinema:     { name: 'Cinema',     icon: 'film',     tint: '#7A5AE0' },
  whoshome:   { name: "Who's Home",  icon: 'person',   tint: '#34A853' },
  settings:   { name: 'Settings',   icon: 'gear',     tint: '#8A8A8A' },
  docs:       { name: 'Docs',       icon: 'calendar', tint: '#C0793F' },
  cameras:       { name: 'Cameras',       icon: 'camera',   tint: '#4A5568' },
  notifications: { name: 'Notifications', icon: 'bell',     tint: '#4A90D9' },
} as const;

/** Maximum number of user-chosen tab bar slots (excludes the pinned More tab). */
export const MAX_TABS = 4;

/**
 * Maps a route id to a screen component name.
 * Used by AppShell to resolve which screen to render.
 * Screen components are registered separately to avoid circular imports.
 */
export const SCREEN_IDS = [
  'home', 'lights', 'doors', 'garage', 'climate', 'pool',
  'music', 'fans', 'tv', 'irrigation', 'leak', 'motion',
  'outdoors', 'cinema', 'whoshome', 'settings', 'docs', 'customize', 'more',
  'scenes', 'editfav', 'editscenes', 'cameras', 'notifications',
] as const;

export type ScreenId = typeof SCREEN_IDS[number];

/** Tab slots that reset the nav stack when selected. */
export function isTabSlot(id: string, tabs: string[]): boolean {
  return tabs.includes(id) || id === 'more';
}

/**
 * The sections that are not on the tab bar, in the order the More screen shows
 * them: alphabetical by display name, with Docs then Settings pinned last.
 * The tablet sidebar fills its spare height from the front of this list.
 */
export function moreOrder(
  sections: Record<string, { name: string }>,
  tabs: string[],
): string[] {
  const PINNED_BOTTOM = ['docs', 'settings'];
  return Object.keys(sections)
    .filter((id) => !tabs.includes(id))
    .sort((a, b) => {
      const ai = PINNED_BOTTOM.indexOf(a);
      const bi = PINNED_BOTTOM.indexOf(b);
      if (ai !== -1 || bi !== -1) {
        if (ai !== -1 && bi !== -1) return ai - bi;
        return ai !== -1 ? 1 : -1;
      }
      return sections[a].name.localeCompare(sections[b].name);
    });
}
