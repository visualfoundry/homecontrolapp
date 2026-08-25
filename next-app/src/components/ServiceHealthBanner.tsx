'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import type { HealthState } from '@/types/state';

/**
 * Says so when the app can't be trusted.
 *
 * Two failures used to be completely silent from the UI, and both leave the user
 * working the house from something untrue:
 *
 *   - An EISY stops answering. Its last values stay in the cache and every tile
 *     it owns goes on stating them with total confidence.
 *   - A command is refused. /command answered 202 before it ever spoke to the
 *     EISY, so the optimistic value just expires and the control slides back with
 *     no reason offered.
 *
 * Both come from the service's `_health` key. This sits in the shell rather than
 * on the Home screen because commands are sent from every screen, so the answer
 * has to be visible from every screen — and below the scroll area, not above it,
 * so it can't be scrolled out of sight while it still applies.
 */

/** How long a refused command stays on screen. Long enough to be read after
 *  looking up from the tile that just reverted, short enough that it doesn't
 *  outlive its own relevance. */
const CMD_ERR_TTL_MS = 45_000;

export function ServiceHealthBanner() {
  const { st, config } = useHC();
  const health = st['_health'] as HealthState | undefined;

  const [dismissedAt, setDismissedAt] = React.useState('');
  // A refused command expires on its own, so the banner has to re-render at the
  // deadline rather than waiting for the next patch to happen along.
  const [, tick] = React.useState(0);

  const cmdAt = health?.cmdErrAt ?? '';
  const cmdFresh =
    !!cmdAt && cmdAt !== dismissedAt && Date.now() - Date.parse(cmdAt) < CMD_ERR_TTL_MS;

  React.useEffect(() => {
    if (!cmdFresh) return;
    const left = CMD_ERR_TTL_MS - (Date.now() - Date.parse(cmdAt));
    const t = setTimeout(() => tick(n => n + 1), Math.max(1_000, left));
    return () => clearTimeout(t);
  }, [cmdAt, cmdFresh]);

  const degraded = health?.degraded === true;
  if (!degraded && !cmdFresh) return null;

  // A refused command is the more specific complaint, so it wins the one slot.
  const kind = cmdFresh ? 'command' : 'stale';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '10px var(--screen-px)',
        background: 'var(--amber)',
        color: '#fff',
        borderTop: '0.5px solid rgba(0,0,0,0.12)',
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0, opacity: 0.95 }}>
        <Icon name="bolt" size={19} strokeWidth={2.3} />
      </span>

      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.35 }}>
        {kind === 'command' ? (
          <>
            <strong style={{ fontWeight: 680 }}>
              {nameFor(health!.cmdErrTarget, config)} didn&rsquo;t respond
            </strong>
            {' — the hub refused the command, so nothing changed.'}
          </>
        ) : (
          <>
            <strong style={{ fontWeight: 680 }}>Some readings may be out of date</strong>
            {' — '}
            {staleWhere(health!, config)}
            {' '}
            {staleAge(health!.staleSeconds)}
          </>
        )}
      </span>

      {kind === 'command' && (
        <button
          onClick={() => setDismissedAt(cmdAt)}
          aria-label="Dismiss"
          style={{
            flexShrink: 0, background: 'rgba(255,255,255,0.22)', border: 'none',
            color: '#fff', borderRadius: 12, height: 24, padding: '0 10px',
            fontSize: 12, fontWeight: 620, cursor: 'pointer',
          }}
        >
          Got it
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Naming the damage
//
// The service speaks in state ids because that is all it has — it holds no names.
// Turning those back into something a person recognises is the config plane's
// job, which is why it happens here and not in the service.
// ---------------------------------------------------------------------------

type Cfg = ReturnType<typeof useHC>['config'];

/** Name a state id, via the config id that maps to it. Harmony boxes and other
 *  targets with no WP control behind them fall back to a bare noun rather than
 *  showing the user an EISY address. */
function nameFor(stateId: string, config: Cfg): string {
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
 * which tells the reader nothing except that the list was truncated. Past two, the
 * count is the honest summary.
 */
function staleWhere(health: HealthState, config: Cfg): string {
  const prefixes = health.staleEisys
    .split(',')
    .filter(Boolean)
    .map(i => `eisy${i}/`);
  if (prefixes.length === 0) return 'some devices aren’t reporting.';

  const places = new Set<string>();
  let affected = 0;
  for (const [configId, sid] of Object.entries(config.controlStateIds)) {
    if (!prefixes.some(p => sid.startsWith(p))) continue;
    affected++;
    const place = config.controlPlaces[configId];
    if (place) places.add(place);
  }

  if (affected === 0) return 'a controller isn’t reporting.';

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
