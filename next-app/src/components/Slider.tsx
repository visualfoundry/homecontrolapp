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


import React, { useCallback, useEffect, useRef, useState } from 'react';

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

/** Longest a drag may go without telling the parent. Without this the slider
 *  emits a value per pointermove — dozens a second, and on every screen that
 *  wires `onChange` straight to `setD` that is a command POST each. One drag of
 *  the Music screen's global volume (which fans out to every active zone) has
 *  put 38 commands on the wire inside two seconds. Beyond hammering the hub,
 *  that floods the handful of connections Safari allows the origin over
 *  HTTP/1.1, and requests caught by a suspend never give theirs back. */
const EMIT_MS = 100;

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
  const emitted = useRef<number>(value);
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What the track paints mid-drag. This leads the parent's `value` so the fill
  // still follows the finger every move while `onChange` is rate-limited.
  const [dragVal, setDragVal] = useState<number | null>(null);

  const emit = useCallback((v: number) => {
    if (emitTimer.current) { clearTimeout(emitTimer.current); emitTimer.current = null; }
    if (emitted.current === v) return;
    emitted.current = v;
    onChange?.(v);
  }, [onChange]);

  useEffect(() => () => {
    if (emitTimer.current) clearTimeout(emitTimer.current);
  }, []);

  /** Snap a pointer x to a value, clamped to the track. */
  const valueAt = useCallback(
    (clientX: number): number | null => {
      const el = ref.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      const raw = min + p * (max - min);
      return Number((Math.round(raw / step) * step).toFixed(decimals));
    },
    [min, max, step, decimals],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const press = valueAt(e.clientX);
      if (press === null) return;
      lastVal.current = press;
      setDragVal(press);
      emit(press); // the press itself is a deliberate act — land it at once

      const move = (ev: PointerEvent) => {
        const v = valueAt(ev.clientX);
        if (v === null || v === lastVal.current) return;
        lastVal.current = v;
        setDragVal(v);
        if (emitTimer.current) return; // an emission is already due
        emitTimer.current = setTimeout(() => {
          emitTimer.current = null;
          emit(lastVal.current);
        }, EMIT_MS);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        emit(lastVal.current); // whatever is under the finger at release wins
        setDragVal(null);
        onCommit?.(lastVal.current);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [disabled, valueAt, emit, onCommit],
  );

  /** Arrow keys move by one step. Computed from `value` directly rather than by
   *  mapping a synthetic x back through the track, which re-snapped and could
   *  lose a step at either end. */
  const nudge = useCallback(
    (dir: 1 | -1) => {
      const next = Number(
        Math.max(min, Math.min(max, value + dir * step)).toFixed(decimals),
      );
      if (next === value) return;
      lastVal.current = next;
      emit(next);
      onCommit?.(next);
    },
    [value, min, max, step, decimals, emit, onCommit],
  );

  const shown = dragVal ?? value;
  const pct = ((shown - min) / (max - min)) * 100;

  return (
    <div
      ref={ref}
      role="slider"
      aria-label={ariaLabel}
      aria-valuenow={shown}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-1);
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
