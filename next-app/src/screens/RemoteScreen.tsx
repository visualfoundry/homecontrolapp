'use client';

import React, { useState } from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/Card';
import { LargeTitle } from '@/components/LargeTitle';
import { RemoteButton } from '@/components/RemoteButton';
import { Toggle } from '@/components/Toggle';
import type { RemoteButton as Btn, TvDevice } from '@/types/config';
import type { FlagState } from '@/types/state';

const AUTO = '__auto';

/** Opened as "remote:<tvId>" — same parameterised-screen pattern as "room:<place>". */
export function RemoteScreen({ tvId }: { tvId?: string }) {
  const { config, st, setD, pressRemote, go } = useHC();
  // Fall back to the first TV that has a hub, so the screen is never empty if it
  // is reached from somewhere that didn't set a target.
  const tv: TvDevice | undefined =
    config.tvs.find(t => t.id === tvId && t.remote)
    ?? config.tvs.find(t => t.remote);

  const [override, setOverride] = useState<string>(AUTO);

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

  // Volume normally belongs to the amp and the keys to the source box, which is
  // why routing is per button group rather than one selected device. An explicit
  // override sends everything to one device.
  const volumeTarget = override === AUTO ? remote.volumeId : override;
  const navTarget    = override === AUTO ? remote.navId    : override;
  const nameOf = (id: string) => remote.devices.find(d => d.id === id)?.name ?? id;

  const press = (target: string) => (b: Btn) => () => pressRemote(target, b);
  const vol = press(volumeTarget);
  const nav = press(navTarget);

  const dpad = (b: Btn, label: string, rotate: number) => (
    <RemoteButton onPress={nav(b)} repeat label={label} size={62}>
      <span style={{ display: 'flex', transform: `rotate(${rotate}deg)` }}>
        <Icon name="chevron" size={26} strokeWidth={2.4} />
      </span>
    </RemoteButton>
  );

  return (
    <div>
      <LargeTitle
        title={tv.name.replace(/\s*TV\s*$/i, '') || tv.name}
        sub={on ? 'On' : 'Off'}
        right={<Toggle on={on} onChange={(v) => setD(tv.id, { on: v })} aria-label={`${tv.name} power`} />}
      />

      {/* D-pad */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 62px)', gap: 10,
          justifyContent: 'center', justifyItems: 'center', alignItems: 'center' }}>
          <span /> {dpad('DirectionUp', 'Up', -90)} <span />
          {dpad('DirectionLeft', 'Left', 180)}
          <RemoteButton onPress={nav('Select')} label="OK" size={62} round tint="var(--accent)">
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.3 }}>OK</span>
          </RemoteButton>
          {dpad('DirectionRight', 'Right', 0)}
          <span /> {dpad('DirectionDown', 'Down', 90)} <span />
        </div>
      </Card>

      {/* Volume */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <RemoteButton onPress={vol('VolumeDown')} repeat label="Volume down">
            <Icon name="minus" size={26} strokeWidth={2.6} />
          </RemoteButton>
          <RemoteButton onPress={vol('Mute')} label="Mute">
            <Icon name="mute" size={24} />
          </RemoteButton>
          <RemoteButton onPress={vol('VolumeUp')} repeat label="Volume up">
            <Icon name="plus" size={26} strokeWidth={2.6} />
          </RemoteButton>
        </div>
      </Card>

      {/* Transport */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <RemoteButton onPress={nav('Rewind')} repeat label="Rewind" size={54}>
            <Icon name="prev" size={22} />
          </RemoteButton>
          <RemoteButton onPress={nav('Play')} label="Play" size={54}>
            <Icon name="play" size={22} />
          </RemoteButton>
          <RemoteButton onPress={nav('Pause')} label="Pause" size={54}>
            <Icon name="pause" size={22} />
          </RemoteButton>
          <RemoteButton onPress={nav('Stop')} label="Stop" size={54}>
            <Icon name="stop" size={18} />
          </RemoteButton>
          <RemoteButton onPress={nav('FastForward')} repeat label="Fast forward" size={54}>
            <Icon name="next" size={22} />
          </RemoteButton>
        </div>
      </Card>

      {/* Routing — IR gives no feedback, so being explicit about which box each
          key reaches is the only way to make a wrong guess diagnosable. */}
      <Card>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)',
          textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
          Sending to
        </div>
        {remote.devices.length > 1 && (
          // Pills that wrap rather than a segmented control: the Cinema has six
          // targets, which no fixed-width segment row survives on a phone.
          <div role="group" aria-label="Remote target device"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
            {[{ id: AUTO, name: 'Auto' }, ...remote.devices].map(d => {
              const sel = override === d.id;
              return (
                <button key={d.id} onClick={() => setOverride(d.id)} aria-pressed={sel}
                  style={{
                    border: 'none', cursor: 'pointer', borderRadius: 16,
                    padding: '7px 13px', fontSize: 13, fontWeight: 600,
                    background: sel ? 'var(--accent)' : 'var(--icon-bg)',
                    color: sel ? '#fff' : 'var(--text)',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  {d.name}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
          Volume · <span style={{ color: 'var(--text)' }}>{nameOf(volumeTarget)}</span><br />
          Keys · <span style={{ color: 'var(--text)' }}>{nameOf(navTarget)}</span>
        </div>
      </Card>

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
