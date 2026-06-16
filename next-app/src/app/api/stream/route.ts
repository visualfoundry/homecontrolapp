// GET /api/stream — SSE patch stream
//
// Format: `event: patch` / `data: {"id":...,"patch":{...}}` plus `: heartbeat`
// comments to keep idle connections alive. On reconnect the client re-seeds
// from /state (M4).
//
// Proxy boundary: when STATE_API_BASE_URL is set, pipe the real service's
// /stream through this same-origin route; otherwise serve the mock stream.
// (Per-event id translation will be added with the id map — see state-service.)

import { type NextRequest } from 'next/server';
import { subscribe } from '@/lib/mock-state';
import { STATE_API_BASE_URL, idMaps } from '@/lib/state-service';

export const dynamic = 'force-dynamic';

const SSE_HEADERS = {
  'Content-Type':  'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection':    'keep-alive',
  'X-Accel-Buffering': 'no',
};

// Remap each `data: {"id":<stateId>,...}` line's id → config id(s), leaving
// event lines, comments (`:`), and blank lines untouched. Buffers partial lines.
// When multiple WP controls share one ISY variable, emits one data line per id.
function idRemapStream(stateToConfig: Record<string, string[]>): TransformStream<Uint8Array, Uint8Array> {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = '';
  const remap = (line: string): string[] => {
    if (!line.startsWith('data:')) return [line];
    try {
      const obj = JSON.parse(line.slice(5).trim()) as { id?: unknown };
      if (typeof obj.id === 'string') {
        const ids = stateToConfig[obj.id];
        if (ids && ids.length > 0) {
          return ids.map(id => `data: ${JSON.stringify({ ...obj, id })}`);
        }
      }
    } catch {
      // Not JSON — leave as-is.
    }
    return [line];
  };
  return new TransformStream({
    transform(chunk, controller) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        for (const out of remap(line)) controller.enqueue(enc.encode(out + '\n'));
      }
    },
    flush(controller) {
      if (buf) {
        for (const out of remap(buf)) controller.enqueue(enc.encode(out));
      }
    },
  });
}

export async function GET(req: NextRequest) {
  if (STATE_API_BASE_URL) {
    try {
      const upstream = await fetch(`${STATE_API_BASE_URL}/stream`, {
        headers: { Accept: 'text/event-stream' },
        cache: 'no-store',
        signal: req.signal,
      });
      if (!upstream.ok || !upstream.body) {
        return new Response(`: upstream ${upstream.status}\n\n`, { status: 502, headers: SSE_HEADERS });
      }
      const { stateToConfig } = await idMaps();
      return new Response(upstream.body.pipeThrough(idRemapStream(stateToConfig)), { headers: SSE_HEADERS });
    } catch {
      // Client aborted or upstream unreachable — close cleanly.
      return new Response(': stream proxy closed\n\n', { status: 502, headers: SSE_HEADERS });
    }
  }

  const encoder = new TextEncoder();
  let unsub: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'));
      unsub = subscribe((chunk) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          unsub?.();
        }
      });
    },
    cancel() {
      unsub?.();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
