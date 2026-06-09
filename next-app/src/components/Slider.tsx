'use client';

// =============================================================================
// Slider — pointer-drag slider (brightness / volume / generic)
// Source: .claude/Claude Design/design_handoff_home_control/ui.jsx
//
// - pointerdown on track → window pointermove/pointerup capture
// - value snapped to step, clamped to [min, max]
// - supports decimals (pH 0.1, ORP 5)
// - optional leading icon that inverts color when fill is over it
// =============================================================================

import React, { useCallback, useRef } from 'react';

interface SliderProps {
  value: number;
  onChange?: (value: number) => void;
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  fill?: string;
  track?: string;
  height?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Slider({
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  fill = 'var(--accent)',
  track = 'var(--slider-track)',
  height = 38,
  icon,
  disabled = false,
  'aria-label': ariaLabel,
}: SliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const decimals = (String(step).split('.')[1] ?? '').length;
  const lastVal = useRef<number>(value);

  const compute = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      const raw = min + p * (max - min);
      const snapped = Number((Math.round(raw / step) * step).toFixed(decimals));
      lastVal.current = snapped;
      onChange?.(snapped);
    },
    [onChange, min, max, step, decimals],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      compute(e.clientX);

      const move = (ev: PointerEvent) => compute(ev.clientX);
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        onCommit?.(lastVal.current);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [disabled, compute, onCommit],
  );

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div
      ref={ref}
      role="slider"
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          compute(
            (() => {
              const el = ref.current;
              if (!el) return 0;
              const r = el.getBoundingClientRect();
              return r.left + ((value + step - min) / (max - min)) * r.width;
            })()
          );
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          compute(
            (() => {
              const el = ref.current;
              if (!el) return 0;
              const r = el.getBoundingClientRect();
              return r.left + ((value - step - min) / (max - min)) * r.width;
            })()
          );
        }
      }}
      style={{
        position: 'relative',
        height,
        borderRadius: height / 2.6,
        cursor: disabled ? 'default' : 'pointer',
        background: track,
        overflow: 'hidden',
        flex: 1,
        touchAction: 'none',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
        outline: 'none',
      }}
    >
      {/* Fill */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: `${pct}%`,
          background: fill,
          transition: 'width 80ms linear',
        }}
      />
      {/* Leading icon */}
      {icon && (
        <div
          style={{
            position: 'absolute',
            left: 13,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            color: pct > 14 ? 'rgba(255,255,255,0.95)' : 'var(--text3)',
            zIndex: 1,
            pointerEvents: 'none',
            transition: 'color 80ms linear',
          }}
        >
          {icon}
        </div>
      )}
    </div>
  );
}
