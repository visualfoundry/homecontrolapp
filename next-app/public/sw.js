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
// IndexedDB helpers — bridge between SW (no localStorage) and the app inbox
// ---------------------------------------------------------------------------

const IDB_NAME    = 'hca-sw';
const IDB_VERSION = 2;
const IDB_STORE   = 'inbox';  // queue of pushes the app hasn't drained yet
const IDB_META    = 'meta';   // shared scalars — currently just the unread count

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(IDB_META))  db.createObjectStore(IDB_META,  { keyPath: 'k' });
    };
    req.onsuccess  = () => resolve(req.result);
    req.onerror    = () => reject(req.error);
  });
}

// The app-icon badge mirrors the inbox's UNREAD COUNT — not the number of
// banners sitting in the OS tray. Those two diverge badly: the tray accumulates
// every banner the user never swiped away, while the inbox empties as they read.
// The app writes the authoritative count here whenever it changes; the SW only
// increments it, for pushes that land while the app is closed.
async function swBumpUnread() {
  const db = await openIdb();
  const next = await new Promise((resolve, reject) => {
    const tx    = db.transaction(IDB_META, 'readwrite');
    const store = tx.objectStore(IDB_META);
    const get   = store.get('unread');
    let value = 1;
    get.onsuccess = () => {
      value = (Number(get.result?.v) || 0) + 1;
      store.put({ k: 'unread', v: value });
    };
    tx.oncomplete = () => resolve(value);
    tx.onerror    = () => reject(tx.error);
  });
  db.close();
  return next;
}

async function swStoreNotif(notif) {
  const db = await openIdb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(notif);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
  db.close();
}

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {};
  const url  = data.url ?? '/';
  // Extract screen id from /?screen=X so the click handler can navigate without a reload.
  let screen = null;
  try { screen = new URL(url, self.location.origin).searchParams.get('screen'); } catch {}

  // Build an inbox entry that mirrors InAppNotification in the app.
  // `screen` is carried through so tapping the inbox row navigates to the same
  // place tapping the system notification would.
  const notif = {
    // Random suffix, same shape as makeNotifId in the app: the store is keyed by
    // id, so two pushes landing in the same millisecond would otherwise collapse
    // into one inbox entry while the badge counted both.
    id:        `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    title:     data.title    ?? 'Home Control',
    body:      data.body     ?? '',
    timestamp: Date.now(),
    read:      false,
    category:  data.category ?? 'push',
    ...(screen ? { screen } : {}),
    // Carried into the inbox so a repeating alert (a leak re-firing every 30 min)
    // refreshes one row instead of filling the list with copies of itself.
    ...(data.tag ? { tag: data.tag } : {}),
    ...(data.urgent ? { urgent: true } : {}),
  };

  e.waitUntil(
    (async () => {
      // Show the system notification. Urgent alerts (leaks) stay on screen until
      // the user acts on them and buzz on arrival; a repeat of the same alert
      // replaces its own banner via `tag` rather than stacking, but `renotify`
      // makes the phone alert again so a repeat isn't silent.
      await self.registration.showNotification(notif.title, {
        body:  notif.body,
        icon:  '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data:  { url, screen },
        ...(data.tag ? { tag: data.tag, renotify: true } : {}),
        ...(data.urgent ? {
          requireInteraction: true,
          vibrate: [300, 120, 300, 120, 300],
        } : {}),
      });

      // Persist to IndexedDB so the app picks it up when it next opens.
      await swStoreNotif(notif);

      // If the app is already open, deliver it immediately via postMessage.
      const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      cs.forEach(c => c.postMessage({ type: 'hca-push-notif', notif }));

      // Update the home-screen icon badge from the unread count.
      if ('setAppBadge' in navigator) {
        const unread = await swBumpUnread().catch(() => 0);
        if (unread > 0) navigator.setAppBadge(unread).catch(() => {});
      }
    })()
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const { url = '/', screen } = e.notification.data ?? {};
  e.waitUntil(
    (async () => {
      // Deliberately no badge update here. Dismissing a banner doesn't read the
      // inbox entry, and this click always focuses or opens the app — which then
      // writes the badge from its own unread count.

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
