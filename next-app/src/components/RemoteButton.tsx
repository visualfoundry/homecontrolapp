'use client';

import React, { useCallback, useEffect, useRef } from 'react';

/**
 * One remote key.
 *
 * Two behaviours a remote needs that a normal button doesn't:
 *
 *  - Press-and-hold auto-repeat. Volume and arrows are unusable without it —
 *    nudging a TV up 10 steps should not be 10 separate taps. Each repeat is a
 *    real IR send, so the interval stays above the hub's round trip.
 *  - Fires on pointer DOWN, not click, so the key feels mechanical rather than
 *    laggy. IR is fire-and-forget, so there is no result to wait for.
 */
export function RemoteButton({
  onPress,
  repeat = false,
  label,
  children,
  size = 62,
  round = false,
  tint,
}: {
  onPress: () => void;
  /** Enable press-and-hold auto-repeat (volume, arrows). */
  repeat?: boolean;
  label: string;
  children: React.ReactNode;
  size?: number;
  round?: boolean;
  tint?: string;
}) {
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; tick?: ReturnType<typeof setInterval> }>({});

  const stop = useCallback(() => {
    if (timers.current.delay) clearTimeout(timers.current.delay);
    if (timers.current.tick) clearInterval(timers.current.tick);
    timers.current = {};
  }, []);

  // Never leave a repeat running if the key unmounts mid-hold.
  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    onPress();
    // A short buzz makes a screen key feel like a button press.
    navigator.vibrate?.(8);
    if (!repeat) return;
    timers.current.delay = setTimeout(() => {
      timers.current.tick = setInterval(onPress, 180);
    }, 420);
  }, [onPress, repeat]);

  return (
    <button
      aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); start(); }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none',
        borderRadius: round ? '50%' : 16,
        background: tint ?? 'var(--icon-bg)',
        color: tint ? '#fff' : 'var(--text)',
        boxShadow: 'var(--shadow)',
        cursor: 'pointer',
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 90ms ease, filter 90ms ease',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
