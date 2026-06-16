'use client';

import { useEffect } from 'react';

export function SwRegistrar() {
  useEffect(() => {
    // iOS standalone PWA: dvh/fill-available are unreliable. window.innerHeight
    // is always the exact visible viewport height in pixels.
    document.documentElement.style.setProperty(
      '--app-height',
      `${window.innerHeight}px`
    );

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
