// =============================================================================
// Service health — reading `_health` and turning it into words
//
// The service publishes health as state ids and EISY indexes, because that is all
// it holds. Naming the damage is the config plane's job, so it happens here.
//
// Two presentations share this: the full message on the Home screen, and a
// one-liner every other screen carries at template level (see ServiceHealth.tsx).
// Both must say the same thing at the same time, which is why the derivation
// lives in one place rather than in either component.
// =============================================================================

import { useEffect, useState } from 'react';
import { useHC } from '@/lib/store';
import type { AppConfig } from '@/types/config';
import type { HealthState } from '@/types/state';

/** How long a refused command stays on screen. Long enough to be read after
 *  looking up from the control that just reverted, short enough that it doesn't
 *  outlive its own relevance. It expires rather than being dismissed — like the
 *  leak banner, this is derived from live state, not a message to acknowledge. */
const CMD_ERR_TTL_MS = 45_000;

export interface ServiceHealth {
  /** A refused command is the more specific complaint, so it wins the one slot. */
  kind: 'command' | 'stale';
  /** The short form, for the one-liner. Complete on its own. */
  brief: string;
  /** The rest of the story, for the Home screen. Empty when there is no more. */
  detail: string;
}

/** Current health, or null when there is nothing wrong worth saying. */
export function useServiceHealth(): ServiceHealth | null {
  const { st, config } = useHC();
  const health = st['_health'] as HealthState | undefined;

  // A refused command expires on its own, so this has to re-render at the
  // deadline rather than waiting for the next patch to happen along.
  const [, tick] = useState(0);
  const cmdAt = health?.cmdErrAt ?? '';
  const cmdFresh = !!cmdAt && Date.now() - Date.parse(cmdAt) < CMD_ERR_TTL_MS;

  useEffect(() => {
    if (!cmdFresh) return;
    const left = CMD_ERR_TTL_MS - (Date.now() - Date.parse(cmdAt));
    const t = setTimeout(() => tick(n => n + 1), Math.max(1_000, left));
    return () => clearTimeout(t);
  }, [cmdAt, cmdFresh]);

  if (cmdFresh && health) {
    return {
      kind: 'command',
      brief: `${nameFor(health.cmdErrTarget, config)} didn’t respond`,
      detail: 'The hub refused the command, so nothing changed.',
    };
  }

  if (health?.degraded === true) {
    return {
      kind: 'stale',
      brief: 'Some readings may be out of date',
      detail: `${staleWhere(health, config)} ${staleAge(health.staleSeconds)}`.trim(),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Naming the damage
// ---------------------------------------------------------------------------

/** Name a state id, via the config id that maps to it. Harmony boxes and other
 *  targets with no WP control behind them fall back to a bare noun rather than
 *  showing the user an EISY address. */
function nameFor(stateId: string, config: AppConfig): string {
  for (const [configId, sid] of Object.entries(config.controlStateIds)) {
    if (sid === stateId) return config.controlNames[configId] ?? 'That device';
  }
  for (const tv of config.tvs) {
    const box = tv.remote?.devices.find(d => d.id === stateId);
    if (box) return box.name;
  }
  return 'That device';
}

/**
 * Which rooms a stale EISY actually affects. Named rooms beat "eisy3", which
 * means nothing to the person holding the phone.
 *
 * Only up to two rooms get named. One EISY here can carry eighteen of them, and
 * "Alex Bathroom, Alex Bedroom and 16 more" names whichever two sort first —
 * which tells the reader nothing except that the list was truncated. Past two,
 * the count is the honest summary.
 */
function staleWhere(health: HealthState, config: AppConfig): string {
  const prefixes = health.staleEisys
    .split(',')
    .filter(Boolean)
    .map(i => `eisy${i}/`);
  if (prefixes.length === 0) return 'Some devices aren’t reporting.';

  const places = new Set<string>();
  let affected = 0;
  for (const [configId, sid] of Object.entries(config.controlStateIds)) {
    if (!prefixes.some(p => sid.startsWith(p))) continue;
    affected++;
    const place = config.controlPlaces[configId];
    if (place) places.add(place);
  }

  if (affected === 0) return 'A controller isn’t reporting.';

  const named = [...places].sort();
  if (named.length === 0) {
    return `${affected} ${affected === 1 ? 'device isn’t' : 'devices aren’t'} reporting.`;
  }
  if (named.length === 1) return `${named[0]} isn’t reporting.`;
  if (named.length === 2) return `${named[0]} and ${named[1]} aren’t reporting.`;
  return `${named.length} rooms aren’t reporting.`;
}

function staleAge(seconds: number): string {
  if (!seconds || seconds < 60) return '';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `Last answered ${mins} min ago.`;
  const hrs = Math.round(mins / 60);
  return `Last answered ${hrs} h ago.`;
}
