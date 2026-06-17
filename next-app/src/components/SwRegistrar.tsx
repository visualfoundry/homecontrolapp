'use client';

import { useEffect } from 'react';

export function SwRegistrar() {
  useEffect(() => {
    // On iOS standalone PWA, window.innerHeight excludes the home indicator area
    // even with viewport-fit=cover. screen.height gives the full physical screen.
    const isIOSStandalone = (navigator as { standalone?: boolean }).standalone === true;
    document.documentElement.style.setProperty(
      '--app-height',
      `${isIOSStandalone ? screen.height : window.innerHeight}px`
    );

    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      } else {
        // In development, unregister any previously installed SW so it stops
        // intercepting requests and serving stale cached chunks.
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        });
      }
    }
  }, []);
  return null;
}
