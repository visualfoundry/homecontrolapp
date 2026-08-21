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

    if (!('serviceWorker' in navigator)) return;

    // An installed PWA is resumed, not re-navigated, so it can keep running the
    // JS from whichever build it first loaded — indefinitely, until it is
    // force-quit. That is how a deploy can be live on the server and invisible on
    // the phone. So: ask for an update on every resume, and reload once the new
    // worker takes control (sw.js calls skipWaiting, so that happens promptly).
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    let stopWatching = () => {};

    const onControllerChange = () => {
      // No previous controller means this is the first install claiming the page,
      // not a new build replacing one — nothing to reload for.
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker.register('/sw.js').then(reg => {
      const checkForUpdate = () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', checkForUpdate);
      window.addEventListener('pageshow', checkForUpdate);
      stopWatching = () => {
        document.removeEventListener('visibilitychange', checkForUpdate);
        window.removeEventListener('pageshow', checkForUpdate);
      };
    }).catch(() => {});

    return () => {
      stopWatching();
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);
  return null;
}
