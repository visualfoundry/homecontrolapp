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
  /** Compact variant — reduces padding and sizes to hit ~96px height */
  compact?: boolean;
  'data-control'?: string;
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
  compact = false,
  'data-control': dataControl,
}: TileProps) {
  const color = activeColor ?? tint ?? 'var(--accent)';
  const caption = status ?? label;
  const chipSize = compact ? 32 : 40;
  const chipRadius = compact ? 10 : 12;
  const iconSize = compact ? 19 : 22;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onTap ?? (() => onToggle?.(!active))}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (onTap ?? (() => onToggle?.(!active)))(); } }}
      className={className}
      data-control={dataControl}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: compact ? 12 : 'var(--card-pad)',
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
        minHeight: 96,
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
          width: chipSize, height: chipSize, borderRadius: chipRadius, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'rgba(255,255,255,0.22)' : 'var(--icon-bg)',
          color: active ? '#fff' : 'var(--text2)',
          transition: 'background 200ms ease, color 200ms ease',
        }}>
          <Icon name={icon} size={iconSize} strokeWidth={1.9} />
        </div>
        {control ?? (onToggle && (
          <Toggle
            on={active}
            onChange={onToggle}
            accent={active ? 'rgba(255,255,255,0.9)' : color}
            size={compact ? 0.72 : 0.82}
          />
        ))}
      </div>

      {/* Bottom: name + status */}
      <div style={{ marginTop: compact ? 0 : 14 }}>
        <div style={{
          fontSize: compact ? 13.5 : 15.5, fontWeight: 640, letterSpacing: -0.3,
          color: active ? '#fff' : 'var(--text)',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: compact ? 1 : 2, WebkitBoxOrient: 'vertical',
        }}>
          {name}
        </div>
        {caption && (
          <div style={{
            fontSize: compact ? 12 : 13, fontWeight: 500, marginTop: 2,
            color: active ? 'rgba(255,255,255,0.85)' : 'var(--text2)',
          }}>
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}
