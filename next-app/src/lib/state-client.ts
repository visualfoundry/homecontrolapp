// =============================================================================
// State client — Home Control App
//
// Thin wrapper for the state plane: GET /state, GET /stream (SSE), POST /command.
// BASE URL from NEXT_PUBLIC_STATE_API_BASE_URL — no branching on mock vs real.
// =============================================================================

import type { StateMap } from '@/types/state';
import { dispatchSessionExpired } from '@/lib/auth';

// Same-origin Next proxy (/api/{state,stream,command}) by default — the proxy
// forwards to the real service (STATE_API_BASE_URL) or serves the mock. Override
// only to bypass the proxy and hit a state service directly (needs CORS).
const BASE = process.env.NEXT_PUBLIC_STATE_API_BASE_URL ?? '/api';

// ---------------------------------------------------------------------------
// GET /state — full snapshot
// ---------------------------------------------------------------------------

/** Fetch the full device state map from /state. Strips the `ts` timestamp key. */
export async function fetchState(): Promise<StateMap> {
  const res = await fetch(`${BASE}/state`, {
    cache: 'no-store',
    // Every request needs a deadline. A GET caught mid-flight by a suspend can
    // otherwise sit unresolved indefinitely, holding one of the six connections
    // Safari allows this origin over HTTP/1.1 — lose all six and the app goes
    // mute while still looking perfectly alive.
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) { dispatchSessionExpired(); throw new Error('GET /state 401'); }
  if (!res.ok) throw new Error(`GET /state ${res.status}`);
  const { ts: _ts, ...state } = (await res.json()) as Record<string, unknown>;
  return state as StateMap;
}

// ---------------------------------------------------------------------------
// POST /command — issue a change
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget POST to /command. The 202 is NOT confirmation.
 * The confirmed patch arrives on /stream (authoritative).
 */
export function postCommand(
  target: string,
  patch?: Record<string, unknown>,
  action?: string,
): void {
  fetch(`${BASE}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, patch, action }),
    // See fetchState — a command with no deadline is a connection slot the app
    // may never get back.
    signal: AbortSignal.timeout(15_000),
  }).then(res => {
    if (res.status === 401) dispatchSessionExpired();
  }).catch(() => {
    // Swallow network errors — stream reconcile is the source of truth.
  });
}

// ---------------------------------------------------------------------------
// GET /stream — SSE patch stream
// ---------------------------------------------------------------------------

type PatchHandler = (id: string, patch: Record<string, unknown>) => void;

/** Longest silence tolerated before the stream is presumed dead. The service
 *  pings every 30 s, so three missed pings is a connection that isn't there. */
const STALE_MS = 95_000;
/** How often to check that for an app that's been left open. */
const WATCHDOG_MS = 30_000;
/** Stricter bar on resume: a socket the OS killed while the phone slept still
 *  reads as OPEN, so anything past one missed ping is worth rebuilding — a spare
 *  reconnect costs far less than a screen of stale state. */
const RESUME_STALE_MS = 45_000;

export interface StreamHandle {
  /** Close permanently. */
  close(): void;
  /** Re-seed now, and rebuild the connection if it looks dead. Call on resume. */
  revalidate(): void;
}

/**
 * Open an SSE connection to /stream.
 *
 * - Calls `onPatch(id, patch)` for each `event: patch` message.
 * - On error / disconnect: calls `onReseed()` then reconnects after 3 s.
 *
 * A frozen tab is the case `onerror` doesn't cover. When the OS suspends a
 * backgrounded PWA it tears the socket down underneath us, and on resume the
 * EventSource can sit there reporting OPEN while nothing will ever arrive again
 * — the app shows state frozen at the moment it was backgrounded, and only a
 * force-quit fixes it. So liveness is tracked from the last byte seen rather
 * than from readyState, and `revalidate()` (on resume, and on a watchdog for an
 * app left open) reseeds and rebuilds a stream that has gone quiet.
 */
export function connectSSE(
  onPatch: PatchHandler,
  onReseed: () => void,
): StreamHandle {
  let es: EventSource | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSeen = Date.now();
  let lastRevalidate = 0;
  // Every attempt to open a stream claims a generation, and anything left in
  // flight by an older attempt — the auth probe below, a scheduled reconnect —
  // checks its own generation before acting.
  //
  // Without that guard, resume orphans sockets. `onerror` fires for the socket
  // the suspend killed and starts an auth probe; `revalidate` fires on the same
  // resume and rebuilds the stream while that probe is still open; the probe
  // then lands and reconnects *again*, overwriting `es` and leaving the stream
  // it replaced open with nothing referencing it. Nothing can ever close that
  // one — not even `close()`. Six of them exhausts Safari's per-host pool on
  // HTTP/1.1, and from then on every request the app makes is queued behind a
  // connection that will never free: the UI still renders from memory, but
  // commands silently never leave the phone and only a force-quit clears it.
  let gen = 0;

  /** Drop the live socket and any scheduled reconnect. Safe to call repeatedly. */
  function teardown() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (es) {
      es.onopen = null;
      es.onerror = null;
      es.close();
      es = null;
    }
  }

  function scheduleReconnect(myGen: number) {
    if (closed || myGen !== gen) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (closed || myGen !== gen) return;
      onReseed();
      connect();
    }, 3_000);
  }

  function connect() {
    if (closed) return;
    // Never leave the previous socket unreferenced but open.
    teardown();
    const myGen = ++gen;
    lastSeen = Date.now();
    const src = new EventSource(`${BASE}/stream`);
    es = src;

    src.onopen = () => { if (myGen === gen) lastSeen = Date.now(); };

    // Keepalive. Any traffic counts as proof of life, but the service's ping is
    // the only thing guaranteed to arrive on an idle house.
    src.addEventListener('ping', () => { if (myGen === gen) lastSeen = Date.now(); });

    src.addEventListener('patch', (e: MessageEvent) => {
      if (myGen !== gen) return;
      lastSeen = Date.now();
      try {
        const { id, patch } = JSON.parse(e.data as string) as {
          id: string;
          patch: Record<string, unknown>;
        };
        onPatch(id, patch);
      } catch {
        // Malformed event — ignore.
      }
    });

    src.onerror = () => {
      // Already superseded — this socket is nobody's stream now, just close it.
      if (myGen !== gen) { src.close(); return; }
      teardown();
      if (closed) return;
      // Probe auth before reconnecting — 401 means the session expired, not a
      // transient error. The timeout is not optional: an unanswered probe holds
      // a connection slot for as long as the OS is willing to wait.
      fetch('/api/auth/check', { signal: AbortSignal.timeout(6_000) }).then(r => {
        if (closed || myGen !== gen) return;
        if (r.status === 401) {
          dispatchSessionExpired();
          // Don't reconnect here — AuthGate re-auths, and the watchdog below
          // rebuilds the stream once the session is good again.
        } else {
          scheduleReconnect(myGen);
        }
      }).catch(() => {
        // Network unreachable (or the probe timed out) — retry normally.
        scheduleReconnect(myGen);
      });
    };
  }

  /** Drop the current connection and open a new one immediately. */
  function reconnectNow() {
    if (closed) return;
    // Release the socket before the reseed GET goes out, so the GET isn't
    // queued behind the very connection we are replacing.
    teardown();
    onReseed();
    connect();
  }

  connect();

  const watchdog = setInterval(() => {
    if (closed || document.visibilityState !== 'visible') return;
    if (Date.now() - lastSeen > STALE_MS) reconnectNow();
  }, WATCHDOG_MS);

  return {
    close() {
      closed = true;
      gen++; // invalidate every callback still in flight
      clearInterval(watchdog);
      teardown();
    },
    revalidate() {
      if (closed) return;
      // visibilitychange, pageshow and focus all fire on one resume — reseeding
      // three times over is just three GETs for the same answer.
      if (Date.now() - lastRevalidate < 2_000) return;
      lastRevalidate = Date.now();

      const dead = es === null
        || es.readyState === EventSource.CLOSED
        || Date.now() - lastSeen > RESUME_STALE_MS;
      // reconnectNow reseeds on its way through, so don't pay for two.
      if (dead) reconnectNow();
      // Even a stream that survived the background may have missed patches while
      // the tab was frozen, and /state is one cheap GET.
      else onReseed();
    },
  };
}
