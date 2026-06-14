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
  const res = await fetch(`${BASE}/state`, { cache: 'no-store' });
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

/**
 * Open an SSE connection to /stream.
 *
 * - Calls `onPatch(id, patch)` for each `event: patch` message.
 * - On error / disconnect: calls `onReseed()` then reconnects after 3 s.
 *
 * Returns a cleanup function — call it to close the connection permanently.
 */
export function connectSSE(
  onPatch: PatchHandler,
  onReseed: () => void,
): () => void {
  let es: EventSource | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (closed) return;
    es = new EventSource(`${BASE}/stream`);

    es.addEventListener('patch', (e: MessageEvent) => {
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

    es.onerror = () => {
      es?.close();
      es = null;
      if (closed) return;
      // Probe auth before reconnecting — 401 means session expired, not a transient error.
      fetch('/api/auth/check').then(r => {
        if (r.status === 401) {
          dispatchSessionExpired();
          // Don't reconnect — AuthGate will re-auth and the app will remount.
        } else {
          reconnectTimer = setTimeout(() => {
            onReseed();
            connect();
          }, 3_000);
        }
      }).catch(() => {
        // Network unreachable — retry normally.
        reconnectTimer = setTimeout(() => {
          onReseed();
          connect();
        }, 3_000);
      });
    };
  }

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    es?.close();
  };
}
