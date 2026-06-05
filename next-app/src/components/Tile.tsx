'use client';

// =============================================================================
// Tile — device shortcut tile (2-col grid)
// Source: design README — Tiles section
//
// Whole tile is tappable (primary action = toggle). Active state swaps
// background to activeColor/tint, text/icon to white, with optional radial glow.
// A corner Toggle mirrors state and stops propagation, or pass `control` for
// an arbitrary control element.
// =============================================================================

import React from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { Toggle } from '@/components/Toggle';

interface TileProps {
  icon: IconName;
  name: string;
  /** Status line e.g. "On · 55%", "Locked". Alias: label */
  status?: string;
  label?: string;
  active: boolean;
  /** Active background color (default: var(--accent)). Also accepts tint. */
  activeColor?: string;
  tint?: string;           // alias for activeColor
  onTap?: () => void;
  onToggle?: (next: boolean) => void;
  /** Arbitrary control element (top-right corner). Overrides onToggle. */
  control?: React.ReactNode;
  glow?: boolean;
  className?: string;
}

export function Tile({
  icon,
  name,
  status,
  label,
  active,
  activeColor,
  tint,
  onTap,
  onToggle,
  control,
  glow = false,
  className,
}: TileProps) {
  const color = activeColor ?? tint ?? 'var(--accent)';
  const caption = status ?? label;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onTap ?? (() => onToggle?.(!active))}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (onTap ?? (() => onToggle?.(!active)))(); } }}
      className={className}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 'var(--card-pad)',
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        textAlign: 'left',
        background: active ? color : 'var(--card)',
        boxShadow: active && glow
          ? `var(--shadow), 0 0 24px ${color}55`
          : 'var(--shadow)',
        color: active ? '#fff' : 'var(--text)',
        transition: 'background 200ms ease, box-shadow 200ms ease, color 200ms ease',
        WebkitTapHighlightColor: 'transparent',
        minHeight: 116,
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      {/* Radial glow blob */}
      {glow && active && (
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 90, height: 90, borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)', filter: 'blur(18px)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Top row: icon chip + control */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'rgba(255,255,255,0.22)' : 'var(--icon-bg)',
          color: active ? '#fff' : 'var(--text2)',
          transition: 'background 200ms ease, color 200ms ease',
        }}>
          <Icon name={icon} size={22} strokeWidth={1.9} />
        </div>
        {control ?? (onToggle && (
          <Toggle
            on={active}
            onChange={onToggle}
            accent={active ? 'rgba(255,255,255,0.9)' : color}
            size={0.82}
          />
        ))}
      </div>

      {/* Bottom: name + status */}
      <div style={{ marginTop: 14 }}>
        <div style={{
          fontSize: 15.5, fontWeight: 640, letterSpacing: -0.3,
          color: active ? '#fff' : 'var(--text)',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {name}
        </div>
        {caption && (
          <div style={{
            fontSize: 13, fontWeight: 500, marginTop: 2,
            color: active ? 'rgba(255,255,255,0.85)' : 'var(--text2)',
          }}>
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}
