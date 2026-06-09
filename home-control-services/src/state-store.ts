// =============================================================================
// State store — in-memory device state cache + SSE fan-out
//
// applyPatch(id, patch): shallow-merge a patch into one device's state.
//   - Only emits an SSE event when a value actually changes.
//   - First insertion (no prior state) always emits.
//
// subscribe(handler): register a callback that receives raw SSE chunks.
//   Returns an unsubscribe function.
//
// getSnapshot(): returns the full flat state map (all devices).
// =============================================================================

type StatePatch = Record<string, unknown>;
type SseHandler = (chunk: string) => void;

const state: Record<string, StatePatch> = {};
const subscribers = new Set<SseHandler>();

// ---------------------------------------------------------------------------
// Patch + emit
// ---------------------------------------------------------------------------

export function applyPatch(id: string, patch: StatePatch): void {
  const current = state[id];

  // Determine which fields actually changed
  const delta: StatePatch = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!current || current[k] !== v) delta[k] = v;
  }
  if (Object.keys(delta).length === 0) return;

  state[id] = current ? { ...current, ...delta } : { ...patch };

  const event =
    'event: patch\n' +
    `data: ${JSON.stringify({ id, patch: delta, ts: new Date().toISOString() })}\n\n`;

  for (const handler of subscribers) {
    try {
      handler(event);
    } catch {
      subscribers.delete(handler);
    }
  }
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export function getSnapshot(): Record<string, unknown> {
  return { ...state, ts: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Subscribe / unsubscribe
// ---------------------------------------------------------------------------

export function subscribe(handler: SseHandler): () => void {
  subscribers.add(handler);
  return () => subscribers.delete(handler);
}
