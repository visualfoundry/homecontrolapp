'use client';

// =============================================================================
// Avatar — person avatar with presence indicator
// Source: .claude/Claude Design/design_handoff_home_control/ui.jsx
//
// Initials on a generated hue. Present = colored + green dot; Away = grey.
// Tappable to toggle presence (Who's Home on the dashboard).
// =============================================================================

import React from 'react';

// Hue map for the first initial — matches the prototype
const HUE_MAP: Record<string, number> = {
  A: 28, G: 200, J: 330, L: 150, P: 265, V: 45,
};

function hueForInitial(ch: string): number {
  return HUE_MAP[ch] ?? 220;
}

interface AvatarProps {
  name: string;
  present: boolean;
  size?: number;
  onClick?: () => void;
}

export function Avatar({ name, present, size = 46, onClick }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const hue = hueForInitial(initials[0] ?? '');

  const inner = (
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* Circle */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.36,
          fontWeight: 640,
          color: present ? '#fff' : 'var(--text3)',
          background: present ? `oklch(0.62 0.13 ${hue})` : 'var(--switch-off)',
          opacity: present ? 1 : 0.7,
          transition: 'background 200ms ease, color 200ms ease, opacity 200ms ease',
        }}
      >
        {initials}
      </div>
      {/* Presence dot */}
      <span
        style={{
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: 13,
          height: 13,
          borderRadius: '50%',
          background: present ? 'var(--green)' : 'var(--text3)',
          border: '2.5px solid var(--card)',
          transition: 'background 200ms ease',
        }}
      />
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${name} — ${present ? 'home' : 'away'}`}
        aria-pressed={present}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          borderRadius: '50%',
        }}
      >
        {inner}
      </button>
    );
  }

  return inner;
}
