'use client';

// =============================================================================
// Segmented — segmented control (filter / mode picker)
// Source: .claude/Claude Design/design_handoff_home_control/ui.jsx
// =============================================================================

import React from 'react';

interface SegmentedProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  'aria-label'?: string;
}

export function Segmented({ options, value, onChange, 'aria-label': ariaLabel }: SegmentedProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        background: 'var(--seg-bg)',
        borderRadius: 12,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((o) => {
        const active = o === value;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o)}
            style={{
              flex: 1,
              border: 'none',
              cursor: 'pointer',
              borderRadius: 9,
              padding: '7px 4px',
              fontSize: 14,
              fontWeight: active ? 640 : 520,
              letterSpacing: -0.2,
              color: active ? 'var(--text)' : 'var(--text2)',
              background: active ? 'var(--seg-active)' : 'transparent',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 180ms ease',
              WebkitTapHighlightColor: 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
