'use client';

// =============================================================================
// Card — rounded container with shadow
// SectionTitle — section heading with optional action button
// Source: .claude/Claude Design/design_handoff_home_control/ui.jsx
// =============================================================================

import React from 'react';

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  pad?: boolean; // default true — pass false for custom inner padding
  'data-control'?: string;
}

export function Card({ children, className, style, onClick, pad = true, 'data-control': dataControl }: CardProps) {
  const base: React.CSSProperties = {
    background: 'var(--card)',
    borderRadius: 'var(--radius)',
    padding: pad ? 'var(--card-pad)' : 0,
    boxShadow: 'var(--shadow)',
    ...style,
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        data-control={dataControl}
        style={{ ...base, border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={className} style={base} data-control={dataControl}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionTitle
// ---------------------------------------------------------------------------

interface SectionTitleProps {
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}

export function SectionTitle({ children, action, onAction }: SectionTitleProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        margin: '0 4px 10px',
        padding: '0 2px',
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 680,
          letterSpacing: -0.4,
          color: 'var(--text)',
        }}
      >
        {children}
      </h3>
      {action && (
        <button
          type="button"
          onClick={onAction}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--accent)',
            fontSize: 15,
            fontWeight: 600,
            padding: 0,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
