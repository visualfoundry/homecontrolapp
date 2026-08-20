'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

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
 *
 * And because IR sends no acknowledgement, the press state is the only feedback
 * there is: the key lights up in the accent for as long as it is held, which
 * also makes an auto-repeat visible.
 */
/** Shortest time a pressed key stays lit, so a quick tap is still visible. */
const MIN_LIT_MS = 130;

export function RemoteButton({
  onPress,
  repeat = false,
  label,
  children,
  size = 72,
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
  const timers = useRef<{
    delay?: ReturnType<typeof setTimeout>;
    tick?: ReturnType<typeof setInterval>;
    release?: ReturnType<typeof setTimeout>;
  }>({});
  const pressedAt = useRef(0);
  const [pressed, setPressed] = useState(false);

  const stop = useCallback(() => {
    if (timers.current.delay) clearTimeout(timers.current.delay);
    if (timers.current.tick) clearInterval(timers.current.tick);
    if (timers.current.release) clearTimeout(timers.current.release);
    timers.current = {};
    // A fast tap lifts within a frame or two, which would flash the highlight so
    // briefly it reads as no feedback at all — hold it a beat past the release.
    const held = Date.now() - pressedAt.current;
    if (held >= MIN_LIT_MS) setPressed(false);
    else timers.current.release = setTimeout(() => setPressed(false), MIN_LIT_MS - held);
  }, []);

  // Never leave a repeat running if the key unmounts mid-hold.
  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    if (timers.current.release) clearTimeout(timers.current.release);
    pressedAt.current = Date.now();
    setPressed(true);
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
        borderRadius: round ? '50%' : 18,
        // A tinted key (OK) keeps its colour and just darkens; a plain key takes
        // the accent, which is the clearest "this is the one I hit" there is.
        background: pressed && !tint ? 'var(--accent)' : (tint ?? 'var(--icon-bg)'),
        color: tint || pressed ? '#fff' : 'var(--text)',
        filter: pressed && tint ? 'brightness(0.82)' : 'none',
        boxShadow: pressed ? 'none' : 'var(--shadow)',
        transform: pressed ? 'scale(0.93)' : 'scale(1)',
        cursor: 'pointer',
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 90ms ease, filter 90ms ease, background 90ms ease, color 90ms ease, box-shadow 90ms ease',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
