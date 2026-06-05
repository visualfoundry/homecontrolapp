'use client';

// =============================================================================
// Toggle — iOS-style switch
// Source: .claude/Claude Design/design_handoff_home_control/ui.jsx
//
// 51×31 (×size), knob 27. Spring ease on knob, linear bg transition.
// stopPropagation so toggling inside a tappable tile doesn't fire the tile.
// =============================================================================

import React from 'react';

interface ToggleProps {
  on: boolean;
  onChange?: (next: boolean) => void;
  accent?: string;
  size?: number;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Toggle({
  on,
  onChange,
  accent = 'var(--accent)',
  size = 1,
  disabled = false,
  'aria-label': ariaLabel,
}: ToggleProps) {
  const w = 51 * size;
  const h = 31 * size;
  const knob = 27 * size;
  const inset = 2 * size;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange?.(!on);
      }}
      style={{
        width: w,
        height: h,
        borderRadius: h,
        border: 'none',
        padding: 0,
        cursor: disabled ? 'default' : 'pointer',
        position: 'relative',
        flexShrink: 0,
        background: on ? accent : 'var(--switch-off)',
        transition: `background ${200 * size}ms ease`,
        WebkitTapHighlightColor: 'transparent',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: inset,
          left: on ? w - knob - inset : inset,
          width: knob,
          height: knob,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.04)',
          transition: `left 220ms cubic-bezier(0.3, 1.4, 0.5, 1)`,
        }}
      />
    </button>
  );
}
