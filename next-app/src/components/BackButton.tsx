'use client';

// =============================================================================
// BackButton — absolute back chevron for secondary screens
// Source: .claude/Claude Design/design_handoff_home_control/app.jsx
//
// 38×38 circle, blurred translucent bg, top-left, z-index 40.
// =============================================================================

import React from 'react';
import { Icon } from '@/components/Icon';
import { useHC } from '@/lib/store';

export function BackButton() {
  const { back, prefs } = useHC();
  const dark = prefs.theme === 'dark';

  return (
    <button
      type="button"
      onClick={back}
      aria-label="Back"
      style={{
        position: 'absolute',
        top: 50,
        left: 14,
        zIndex: 40,
        width: 38,
        height: 38,
        borderRadius: 19,
        border: 'none',
        cursor: 'pointer',
        background: dark ? 'rgba(40,40,38,0.7)' : 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon
        name="chevron"
        size={20}
        strokeWidth={2.4}
        style={{ transform: 'rotate(180deg)', marginLeft: -2 } as React.CSSProperties}
      />
    </button>
  );
}
