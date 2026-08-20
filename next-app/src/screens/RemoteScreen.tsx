'use client';

import React from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import { RemoteButton } from '@/components/RemoteButton';
import { Toggle } from '@/components/Toggle';
import type { RemoteButton as Btn, TvDevice } from '@/types/config';
import type { FlagState } from '@/types/state';

/** Key sizes. The pad and volume get the full-size key; the five transport keys
 *  have to sit on one row inside a card on a 375px phone (307px of usable width
 *  after the screen and card padding), which caps them at 56 with a 6px gap. */
const KEY = 72;
const SMALL_KEY = 56;

/** Opened as "remote:<tvId>" — same parameterised-screen pattern as "room:<place>". */
export function RemoteScreen({ tvId }: { tvId?: string }) {
  const { config, st, setD, pressRemote, go } = useHC();
  // Fall back to the first TV that has a hub, so the screen is never empty if it
  // is reached from somewhere that didn't set a target.
  const tv: TvDevice | undefined =
    config.tvs.find(t => t.id === tvId && t.remote)
    ?? config.tvs.find(t => t.remote);

  if (!tv?.remote) {
    return (
      <div>
        <LargeTitle title="Remote" sub="No Harmony hub" />
        <Card>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-2)' }}>
            This room has no Harmony hub with button-capable devices.
          </p>
        </Card>
      </div>
    );
  }

  const { remote } = tv;
  const on = (st[tv.id] as FlagState | undefined)?.on ?? false;

  // Each button carries its own target: volume belongs to the amp and the keys to
  // the source box, and a room can be split further still (the Studio's Apple TV
  // has no volume, its Yamaha amp has nothing else). A button with no target is
  // one no box here learned, and gets no key at all rather than a dead one.
  const has = (b: Btn) => remote.routes[b] !== undefined;
  const press = (b: Btn) => () => pressRemote(remote.routes[b]!, b);

  const dpad = (b: Btn, label: string, rotate: number) => has(b) ? (
    <RemoteButton onPress={press(b)} repeat label={label} size={KEY}>
      <span style={{ display: 'flex', transform: `rotate(${rotate}deg)` }}>
        <Icon name="chevron" size={30} strokeWidth={2.4} />
      </span>
    </RemoteButton>
  ) : <span />;

  const hasPad       = (['DirectionUp', 'DirectionDown', 'DirectionLeft', 'DirectionRight', 'Select', 'Back'] as Btn[]).some(has);
  const hasVolume    = (['VolumeDown', 'Mute', 'VolumeUp'] as Btn[]).some(has);
  const hasTransport = (['Rewind', 'Play', 'Pause', 'Stop', 'FastForward'] as Btn[]).some(has);

  return (
    <div>
      <LargeTitle
        title={tv.name.replace(/\s*TV\s*$/i, '') || tv.name}
        sub={on ? 'On' : 'Off'}
        right={<Toggle on={on} onChange={(v) => setD(tv.id, { on: v })} aria-label={`${tv.name} power`} />}
      />

      {/* D-pad — Back sits in the pad's bottom-right corner, where a real remote
          keeps it, rather than in a row of its own. */}
      {hasPad && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${KEY}px)`, gap: 12,
            justifyContent: 'center', justifyItems: 'center', alignItems: 'center' }}>
            <span /> {dpad('DirectionUp', 'Up', -90)} <span />
            {dpad('DirectionLeft', 'Left', 180)}
            {has('Select') ? (
              <RemoteButton onPress={press('Select')} label="OK" size={KEY} round tint="var(--accent)">
                <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3 }}>OK</span>
              </RemoteButton>
            ) : <span />}
            {dpad('DirectionRight', 'Right', 0)}
            <span /> {dpad('DirectionDown', 'Down', 90)}
            {has('Back') ? (
              <RemoteButton onPress={press('Back')} label="Back" size={KEY}>
                <span style={{ fontSize: 15, fontWeight: 640, letterSpacing: -0.2 }}>Back</span>
              </RemoteButton>
            ) : <span />}
          </div>
        </Card>
      )}

      {/* Volume */}
      {hasVolume && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {has('VolumeDown') && (
              <RemoteButton onPress={press('VolumeDown')} repeat label="Volume down">
                <Icon name="minus" size={30} strokeWidth={2.6} />
              </RemoteButton>
            )}
            {has('Mute') && (
              <RemoteButton onPress={press('Mute')} label="Mute">
                <Icon name="mute" size={28} />
              </RemoteButton>
            )}
            {has('VolumeUp') && (
              <RemoteButton onPress={press('VolumeUp')} repeat label="Volume up">
                <Icon name="plus" size={30} strokeWidth={2.6} />
              </RemoteButton>
            )}
          </div>
        </Card>
      )}

      {/* Transport */}
      {hasTransport && (
        <Card>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', rowGap: 8 }}>
            {has('Rewind') && (
              <RemoteButton onPress={press('Rewind')} repeat label="Rewind" size={SMALL_KEY}>
                <Icon name="prev" size={23} />
              </RemoteButton>
            )}
            {has('Play') && (
              <RemoteButton onPress={press('Play')} label="Play" size={SMALL_KEY}>
                <Icon name="play" size={23} />
              </RemoteButton>
            )}
            {has('Pause') && (
              <RemoteButton onPress={press('Pause')} label="Pause" size={SMALL_KEY}>
                <Icon name="pause" size={23} />
              </RemoteButton>
            )}
            {has('Stop') && (
              <RemoteButton onPress={press('Stop')} label="Stop" size={SMALL_KEY}>
                <Icon name="stop" size={19} />
              </RemoteButton>
            )}
            {has('FastForward') && (
              <RemoteButton onPress={press('FastForward')} repeat label="Fast forward" size={SMALL_KEY}>
                <Icon name="next" size={23} />
              </RemoteButton>
            )}
          </div>
        </Card>
      )}

      <button
        onClick={() => go('tv')}
        style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none',
          color: 'var(--accent)', fontSize: 15, fontWeight: 560, cursor: 'pointer' }}
      >
        All TVs
      </button>
    </div>
  );
}
