// GET /api/stream — SSE patch stream
//
// Sends a text/event-stream of patch events in the format:
//   event: patch
//   data: {"id":"lr-main","patch":{"level":40},"ts":"..."}
//
// Plus `: heartbeat` comments every 25 s to keep proxies from dropping the
// connection. On reconnect the client re-seeds from /state (M4 concern).
//
// In M5 the browser connects directly to STATE_API_BASE_URL/stream instead.

import { subscribe } from '@/lib/mock-state';

export const dynamic = 'force-dynamic';

export function GET() {
  const encoder = new TextEncoder();
  let unsub: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      // Confirm the connection is live
      controller.enqueue(encoder.encode(': connected\n\n'));

      unsub = subscribe((chunk) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Client disconnected mid-write — clean up
          unsub?.();
        }
      });
    },
    cancel() {
      unsub?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      // Disable buffering in nginx / Vercel edge proxies
      'X-Accel-Buffering': 'no',
    },
  });
}
