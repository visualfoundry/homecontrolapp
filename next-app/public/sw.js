// Home Control App — Service Worker
// Strategies:
//   /_next/static/ → cache-first (immutable, content-hashed)
//   /api/state     → network-first, cache offline fallback (last-known state)
//   /api/stream    → pass-through (SSE, never cache)
//   /api/*         → pass-through (commands etc.)
//   navigate       → network-first, fall back to cached shell
//   everything else→ stale-while-revalidate

const CACHE = 'hca-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(['/']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // SSE stream — never intercept
  if (url.pathname === '/api/stream') return;

  // /api/state — network-first, cache last-known state for offline
  if (url.pathname === '/api/state') {
    e.respondWith(networkFirstCache(e.request));
    return;
  }

  // Other API calls — network only
  if (url.pathname.startsWith('/api/')) return;

  // Next.js static assets — cache-first (they are content-hashed)
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  // HTML navigation — network-first, fall back to cached shell
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, r.clone()));
          return r;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Everything else — stale-while-revalidate
  e.respondWith(staleWhileRevalidate(e.request));
});

async function networkFirstCache(req) {
  try {
    const r = await fetch(req);
    if (r.ok) {
      const c = await caches.open(CACHE);
      c.put(req, r.clone());
    }
    return r;
  } catch {
    const cached = await caches.match(req);
    return (
      cached ??
      new Response(JSON.stringify({ error: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const r = await fetch(req);
  if (r.ok) {
    const c = await caches.open(CACHE);
    c.put(req, r.clone());
  }
  return r;
}

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {};
  const url = data.url ?? '/';
  // Extract screen id from /?screen=X so the click handler can navigate without a reload.
  let screen = null;
  try { screen = new URL(url, self.location.origin).searchParams.get('screen'); } catch {}
  e.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title ?? 'Home Control', {
        body:  data.body  ?? '',
        icon:  '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data:  { url, screen },
      });
      // Update the app icon badge with the total number of pending notifications.
      if ('setAppBadge' in navigator) {
        const notifs = await self.registration.getNotifications();
        navigator.setAppBadge(notifs.length).catch(() => {});
      }
    })()
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const { url = '/', screen } = e.notification.data ?? {};
  e.waitUntil(
    (async () => {
      // Recalculate badge after this notification is dismissed.
      if ('setAppBadge' in navigator) {
        const remaining = await self.registration.getNotifications();
        if (remaining.length > 0) navigator.setAppBadge(remaining.length).catch(() => {});
        else navigator.clearAppBadge().catch(() => {});
      }
      // Find any existing HCA window at this origin rather than matching the exact URL
      // (the PWA is a SPA — its URL is always "/" regardless of which screen is shown).
      const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = cs.find(c => {
        try { return new URL(c.url).origin === self.location.origin; } catch { return false; }
      });
      if (existing) {
        // Tell the running app to navigate directly without a reload.
        if (screen) existing.postMessage({ type: 'hca-navigate', screen });
        return existing.focus();
      }
      return clients.openWindow(url);
    })()
  );
});

async function staleWhileRevalidate(req) {
  const c = await caches.open(CACHE);
  const cached = await c.match(req);
  const fresh = fetch(req).then((r) => {
    if (r.ok) c.put(req, r.clone());
    return r;
  });
  return cached ?? fresh;
}
