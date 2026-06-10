'use client';

// =============================================================================
// Icon — Home Control App
// Inline SVG line-icon set. All icons are 24×24 viewBox, currentColor.
// Source: .claude/Claude Design/design_handoff_home_control/ui.jsx ICON_PATHS
// =============================================================================

import React from 'react';

export type IconName =
  | 'home' | 'bulb' | 'lock' | 'unlock' | 'thermo' | 'grid' | 'sunrise'
  | 'moon' | 'film' | 'dining' | 'away' | 'sun' | 'fan' | 'droplet'
  | 'motion' | 'speaker' | 'volume' | 'mute' | 'gear' | 'shield' | 'door'
  | 'garage' | 'grass' | 'person' | 'battery' | 'search' | 'power'
  | 'play' | 'pause' | 'next' | 'prev' | 'waterfall' | 'plus' | 'minus'
  | 'chevron' | 'chevDown' | 'check' | 'bell' | 'bolt' | 'water' | 'refresh'
  | 'calendar' | 'pool' | 'cloud' | 'rain' | 'snow' | 'pergola' | 'layers'
  | 'shades' | 'tv' | 'camera';

const ICON_PATHS: Record<IconName, React.ReactNode> = {
  home:      <><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10.3V20h12v-9.7" /></>,
  bulb:      <><path d="M9.2 18.2h5.6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-3.8 10.6c.7.6 1 1.2 1.1 2.1h5.4c.1-.9.4-1.5 1.1-2.1A6 6 0 0 0 12 3Z" /></>,
  lock:      <><rect x="5" y="10.5" width="14" height="9.5" rx="2.2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  unlock:    <><rect x="5" y="10.5" width="14" height="9.5" rx="2.2" /><path d="M8 10.5V8a4 4 0 0 1 7.5-1.9" /></>,
  thermo:    <><path d="M12 3.5a2 2 0 0 0-2 2v8.2a4 4 0 1 0 4 0V5.5a2 2 0 0 0-2-2Z" /><path d="M12 9v6.5" strokeWidth="2.6" /></>,
  grid:      <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
  sunrise:   <><path d="M12 4v3" /><path d="M5.5 9.5 7 11" /><path d="M18.5 9.5 17 11" /><path d="M3 18h18" /><path d="M6.5 18a5.5 5.5 0 0 1 11 0" /><path d="M2 21h20" /></>,
  moon:      <path d="M20.5 14.2A8 8 0 1 1 10 3.5a6.2 6.2 0 0 0 10.5 10.7Z" />,
  film:      <><rect x="4" y="5" width="16" height="14" rx="2.5" /><path d="M9 5v14M15 5v14M4 9.7h16M4 14.3h16" /></>,
  dining:    <><path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10" /><path d="M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4m0-9c1.5 0 2.5 2 2.5 5s-1 4-2.5 4m0 0v9" /></>,
  away:      <><path d="M14 4h4a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20h-4" /><path d="M4 12h10M10.5 8l4 4-4 4" /></>,
  sun:       <><circle cx="12" cy="12" r="4.2" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" /></>,
  fan:       <><circle cx="12" cy="12" r="1.9" /><path d="M12 10.1 C10.8 7.5 11.2 4.5 13 4 C14.8 3.5 14.5 7 12 10.1" /><path d="M12 10.1 C10.8 7.5 11.2 4.5 13 4 C14.8 3.5 14.5 7 12 10.1" transform="rotate(120 12 12)" /><path d="M12 10.1 C10.8 7.5 11.2 4.5 13 4 C14.8 3.5 14.5 7 12 10.1" transform="rotate(240 12 12)" /></>,
  droplet:   <path d="M12 3.5s6 6.6 6 10.5a6 6 0 0 1-12 0c0-3.9 6-10.5 6-10.5Z" />,
  motion:    <><circle cx="12" cy="13" r="1.6" fill="currentColor" stroke="none" /><path d="M8.5 9.5a5 5 0 0 0 0 7M15.5 9.5a5 5 0 0 1 0 7M6 7a8.5 8.5 0 0 0 0 12M18 7a8.5 8.5 0 0 1 0 12" /></>,
  speaker:   <><rect x="6" y="3" width="12" height="18" rx="3" /><circle cx="12" cy="15" r="3.2" /><circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" /></>,
  volume:    <><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  mute:      <><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5Z" /><path d="m16 9.5 4 5M20 9.5l-4 5" /></>,
  gear:      <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
  shield:    <path d="M12 3.5 5 6v5.5c0 4.3 3 7.5 7 9 4-1.5 7-4.7 7-9V6Z" />,
  door:      <><path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21" /><path d="M4 21h16" /><circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  garage:    <><path d="M4 21V9l8-5 8 5v12" /><path d="M4 21h16" /><path d="M7 21v-8h10v8M7 16h10" /></>,
  grass:     <><path d="M5 21c0-4 1.5-7 3-9M9 21c0-5-.5-9-1-11M12 21c0-4 1-7 2.5-9M15 21c0-5 .5-9 1-11M19 21c-.5-4-2-7-3.5-9" /></>,
  person:    <><circle cx="12" cy="8" r="3.6" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
  battery:   <><rect x="3" y="8" width="16" height="9" rx="2" /><path d="M21 11v3" /><rect x="5" y="10" width="3" height="5" rx="0.5" fill="currentColor" stroke="none" /></>,
  search:    <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.5-3.5" /></>,
  power:     <><path d="M12 3v8" /><path d="M7 6.5a7 7 0 1 0 10 0" /></>,
  play:      <path d="M7 5.5v13l11-6.5Z" />,
  pause:     <><rect x="7" y="5" width="3.5" height="14" rx="1" /><rect x="13.5" y="5" width="3.5" height="14" rx="1" /></>,
  next:      <><path d="M6 5.5v13l9-6.5Z" /><path d="M17 5v14" strokeWidth="2.2" /></>,
  prev:      <><path d="M18 5.5v13L9 12Z" /><path d="M7 5v14" strokeWidth="2.2" /></>,
  waterfall: <><path d="M7 3v8M17 3v8" /><path d="M5 11h14" /><path d="M7 14c0 1.5 1 2 1 3.5M12 14c0 1.5 1 2 1 3.5M17 14c0 1.5-1 2-1 3.5" /></>,
  plus:      <><path d="M12 6v12M6 12h12" /></>,
  minus:     <path d="M6 12h12" />,
  chevron:   <path d="m9 6 6 6-6 6" />,
  chevDown:  <path d="m6 9 6 6 6-6" />,
  check:     <path d="m5 12 5 5 9-11" strokeWidth="2.2" />,
  bell:      <><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z" /><path d="M10.5 20a2 2 0 0 0 3 0" /></>,
  bolt:      <path d="M13 3 5 13h5l-1 8 8-10h-5Z" />,
  water:     <><path d="M4 16c2-1.5 3-1.5 5 0s3 1.5 5 0 3-1.5 5 0" /><path d="M4 11c2-1.5 3-1.5 5 0s3 1.5 5 0 3-1.5 5 0" /></>,
  refresh:   <><path d="M4 12a8 8 0 0 1 13.5-5.8L20 8" /><path d="M20 4v4h-4" /><path d="M20 12a8 8 0 0 1-13.5 5.8L4 16" /><path d="M4 20v-4h4" /></>,
  calendar:  <><rect x="4" y="5" width="16" height="16" rx="2.5" /><path d="M4 9.5h16M8 3v4M16 3v4" /></>,
  pool:      <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  cloud:     <path d="M7 18.5A4.2 4.2 0 0 1 6.6 10 5.3 5.3 0 0 1 17 8.6 3.7 3.7 0 0 1 16.6 18.5Z" />,
  rain:      <><path d="M7.5 15.5A4 4 0 0 1 7 7.4 5 5 0 0 1 16.8 6 3.5 3.5 0 0 1 16.5 15.5" /><path d="M8 18l-1 2.5M12.5 18l-1 2.5M17 18l-1 2.5" /></>,
  snow:      <><path d="M7.5 14.5A4 4 0 0 1 7 6.4 5 5 0 0 1 16.8 5 3.5 3.5 0 0 1 16.5 14.5" /><path d="M9 18.5h.01M12 20h.01M15 18.5h.01M10.5 21h.01M13.5 21h.01" strokeWidth="2.4" /></>,
  pergola:   <><path d="M4 21V8l8-4 8 4v13" /><path d="M4 11h16M4 14.5h16M4 18h16" /></>,
  layers:    <><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 16.5 9 5 9-5" /></>,
  camera:    <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>,
  shades:    <><rect x="3" y="3.5" width="18" height="17" rx="2" /><path d="M3 8h18M3 12.5h18M3 17h18" /></>,
  tv:        <><rect x="2" y="3" width="20" height="14" rx="2.5" /><path d="M8 21h8M12 17v4" /></>,
};

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  fill?: string;
}

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.75,
  className,
  style,
  fill = 'none',
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden
    >
      {ICON_PATHS[name] ?? null}
    </svg>
  );
}
