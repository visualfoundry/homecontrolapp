// =============================================================================
// Service health — the two things the app cannot otherwise know
//
// 1. A stale value and a live one are indistinguishable in the snapshot. The
//    cache holds whatever the last good sweep left behind, so an EISY that stops
//    answering leaves the app showing a confident, wrong answer for as long as
//    the outage lasts — and the user works the house from it.
//
// 2. /command answers 202 and then talks to the EISY asynchronously, so a write
//    the EISY refuses (a 400 on a node that no longer takes the command, say) is
//    invisible to the client that asked for it. The optimistic value simply
//    expires and the switch slides back with no reason given.
//
// Both ride the existing contract under the reserved `_health` id: the Next proxy
// passes ids it has no config mapping for straight through, so /state and
// /stream carry this to the UI with nothing in between needing to know about it.
//
// Every field is a string, boolean or number — never a nested object. applyPatch
// compares with `!==`, so a freshly built object would read as a change on every
// cycle and turn the stream into a per-second heartbeat of noise.
// =============================================================================

import { applyPatch } from './state-store.js';

/** State id the app reads this under. Leading underscore keeps it out of the
 *  device-control id space, the same way `_favs` and `_global` do client-side. */
export const HEALTH_ID = '_health';

/**
 * How long an EISY may go without a complete sweep before its values are called
 * stale. The poll runs every second, so this is ~60 missed cycles: long enough to
 * ride out the bursts of timeouts these units produce under a 1 Hz poll, short
 * enough that a real outage surfaces while the user is still holding the phone.
 */
const STALE_MS = Number(process.env.HEALTH_STALE_MS ?? 60_000);

interface EisyHealth {
  lastOkAt: number;
  lastError: string;
}

const eisys = new Map<number, EisyHealth>();

/** Nothing has been polled at process start, and an EISY that has never
 *  succeeded is not evidence of an outage — it is evidence of a young process.
 *  Seeding from startup keeps the banner off the screen for the first minute. */
const startedAt = Date.now();

function forIdx(idx: number): EisyHealth {
  let h = eisys.get(idx);
  if (!h) { h = { lastOkAt: startedAt, lastError: '' }; eisys.set(idx, h); }
  return h;
}

export function notePollOk(idx: number): void {
  const h = forIdx(idx);
  h.lastOkAt = Date.now();
  h.lastError = '';
}

export function notePollFailed(idx: number, err: unknown): void {
  forIdx(idx).lastError = err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Command failures
// ---------------------------------------------------------------------------

let cmdErrTarget = '';
let cmdErrReason = '';
let cmdErrAt = '';

/** Record a command that reached us but that the EISY would not take. The client
 *  decides how long to keep showing it — we only ever hold the most recent. */
export function noteCommandFailed(target: string, err: unknown): void {
  cmdErrTarget = target;
  cmdErrReason = err instanceof Error ? err.message : String(err);
  cmdErrAt = new Date().toISOString();
}

/** A command that went through clears a previous failure for the same target, so
 *  a retry that works takes the warning away instead of leaving it to time out. */
export function noteCommandOk(target: string): void {
  if (cmdErrTarget !== target) return;
  cmdErrTarget = '';
  cmdErrReason = '';
  cmdErrAt = '';
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

/**
 * Fold current health into `_health`. Safe to call every cycle — applyPatch only
 * emits fields that actually changed, so a healthy house is silent on the stream.
 */
export function publishHealth(): void {
  const now = Date.now();
  const stale: number[] = [];
  for (const [idx, h] of eisys) {
    if (now - h.lastOkAt > STALE_MS) stale.push(idx);
  }
  stale.sort((a, b) => a - b);

  applyPatch(HEALTH_ID, {
    // Comma-joined rather than an array: a new array is never `!==`-equal to the
    // last one, so it would emit a patch every second even while unchanged.
    staleEisys: stale.join(','),
    degraded: stale.length > 0,
    staleSeconds: stale.length > 0
      ? Math.round(Math.max(...stale.map(i => now - forIdx(i).lastOkAt)) / 1000)
      : 0,
    cmdErrTarget,
    cmdErrReason,
    cmdErrAt,
  });
}
