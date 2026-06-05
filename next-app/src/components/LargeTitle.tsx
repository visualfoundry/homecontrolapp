'use client';

// =============================================================================
// LargeTitle — screen heading used at the top of every primary screen
// Source: design README — "LargeTitle" + screens spec
//
// Props:
//   title     — main heading (e.g. "Good morning")
//   sub       — subtitle line (e.g. "The House · All quiet")
//   action    — optional pill button (e.g. "All Off", "Done") top-right
//   onAction  — callback for the pill button
// =============================================================================

import React from 'react';

interface LargeTitleProps {
  title: string;
  sub?: string;
  action?: string;
  onAction?: () => void;
  /** Arbitrary right-side element (overrides action/onAction). */
  right?: React.ReactNode;
  /** Render as the first item in a padded scroll area — adds top spacing */
  first?: boolean;
}

export function LargeTitle({ title, sub, action, onAction, right, first = true }: LargeTitleProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
        paddingTop: first ? 12 : 0,
        paddingBottom: 6,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 33,
            fontWeight: 720,
            letterSpacing: -0.9,
            lineHeight: 1.1,
            color: 'var(--text)',
          }}
        >
          {title}
        </h1>
        {sub && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text2)',
              letterSpacing: -0.1,
            }}
          >
            {sub}
          </p>
        )}
      </div>

      {right ?? (action && (
        <button
          type="button"
          onClick={onAction}
          style={{
            flexShrink: 0,
            marginTop: 6,
            padding: '7px 14px',
            borderRadius: 20,
            border: 'none',
            cursor: 'pointer',
            background: 'var(--card)',
            boxShadow: 'var(--shadow)',
            color: 'var(--accent)',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: -0.1,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {action}
        </button>
      ))}
    </div>
  );
}
