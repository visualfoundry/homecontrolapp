'use client';

import React, { useRef } from 'react';
import { useHC } from '@/lib/store';
import { Icon } from '@/components/Icon';
import { Card, SectionTitle } from '@/components/Card';
import { Toggle } from '@/components/Toggle';
import { Slider } from '@/components/Slider';
import { SpeakerRow } from '@/components/SpeakerRow';
import { LargeTitle } from '@/components/LargeTitle';
import { useSpotifyLibrary } from '@/hooks/useSpotify';
import type { SpotifyTrack } from '@/hooks/useSpotify';
import { useSpotifyContext } from '@/lib/spotify-context';
import type { SpotifyDevice } from '@/lib/spotify-context';
import type { SpeakerState } from '@/types/state';

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const miniBtn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 19, border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.12)', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
};

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'var(--icon-bg)', color: 'var(--text2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent', flexShrink: 0,
};

function LibraryGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
      {children}
    </div>
  );
}

function LibraryCard({ uri, name, artUrl, sub, artCircle = false, isActive = false, onPlay }: {
  uri: string; name: string; artUrl: string | null; sub: string;
  artCircle?: boolean; isActive?: boolean;
  onPlay: (action: string, value?: number, context_uri?: string) => void;
}) {
  return (
    <button onClick={() => onPlay('play_context', undefined, uri)} style={{
      background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      border: isActive ? '2px solid #1DB954' : '2px solid transparent',
      cursor: 'pointer', padding: 0, overflow: 'hidden', textAlign: 'left',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{ position: 'relative' }}>
        {artUrl ? (
          <img src={artUrl} alt={name} style={{
            width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block',
            borderRadius: artCircle ? '50% 50% 0 0' : 0,
          }} />
        ) : (
          <div style={{ width: '100%', aspectRatio: '1', background: 'var(--icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: artCircle ? '50% 50% 0 0' : 0 }}>
            <Icon name="speaker" size={28} strokeWidth={1.5} />
          </div>
        )}
        {isActive && (
          <div style={{
            position: 'absolute', bottom: 6, right: 6,
            background: '#1DB954', borderRadius: '50%',
            width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="play" size={11} strokeWidth={2} style={{ color: '#fff', marginLeft: 1 }} />
          </div>
        )}
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 640, color: isActive ? '#1DB954' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sub}
        </div>
      </div>
    </button>
  );
}

export function MusicScreen() {
  const { st, setD, config } = useHC();
  const { sdkPlayer, spotify, dismissMini } = useSpotifyContext();
  const library = useSpotifyLibrary();
  const [devicePickerOpen, setDevicePickerOpen] = React.useState(false);
  const [availableDevices, setAvailableDevices] = React.useState<SpotifyDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = React.useState(false);

  const openDevicePicker = async () => {
    setDevicePickerOpen(true);
    setDevicesLoading(true);
    const devices = await spotify.fetchDevices();
    const sdkId = sdkPlayer.deviceId;
    // Drop stale SDK browser sessions (type=Computer, not this tab's device), rename current one.
    const cleaned = devices
      .filter(d => d.type !== 'Computer' || (sdkId && d.id === sdkId))
      .map(d => (sdkId && d.id === sdkId) ? { ...d, name: 'This Device' } : d);
    setAvailableDevices(cleaned);
    setDevicesLoading(false);
  };

  const selectDevice = async (device: SpotifyDevice) => {
    setDevicePickerOpen(false);
    await spotify.transferTo(device.id);
    // When routing to the house speaker system, power on any speakers that are off
    if (device.name.toLowerCase().includes('house music') && !anyOn) {
      allOn();
    }
  };

  // Prefer real-time SDK state when the in-browser player is active,
  // fall back to the REST-polled state when another device is active.
  const sdkTrack = sdkPlayer.sdkState?.track_window.current_track;
  const displayTrack: SpotifyTrack | null = sdkTrack ? {
    id: sdkTrack.id,
    name: sdkTrack.name,
    artist: sdkTrack.artists.map(a => a.name).join(', '),
    album: sdkTrack.album.name,
    durationMs: sdkTrack.duration_ms,
    artUrl: sdkTrack.album.images[0]?.url ?? null,
  } : spotify.track;
  const displayIsPlaying = sdkPlayer.sdkState ? !sdkPlayer.sdkState.paused : spotify.isPlaying;
  // Always use the ticker-driven value — SDK position is a frozen snapshot from the last event.
  const displayProgressMs = spotify.progressMs;
  const chipDeviceName = spotify.device
    ? (sdkPlayer.deviceId && spotify.device.id === sdkPlayer.deviceId ? 'This Device' : spotify.device.name)
    : 'No device';
  // Track pre-mute volumes so we can restore them on unmute (global mute only)
  const preMuteVols = useRef<Map<string, number>>(new Map());
  // Capture starting volumes + average when a global-slider drag begins
  const dragBaseVols = useRef<Map<string, number>>(new Map());
  const dragBaseAvg  = useRef<number>(0);

  // Derive the active playlist uri and name from the polling context
  const activePlaylistUri = spotify.context?.type === 'playlist' ? spotify.context.uri : null;
  const activePlaylist = activePlaylistUri
    ? library.playlists.find(pl => pl.uri === activePlaylistUri) ?? null
    : null;

  const zones = config.musicZones.map(m => ({
    ...m,
    s: (st[m.id] as SpeakerState | undefined) ?? { on: false, vol: 0 },
  }));
  const playing = zones.filter(z => z.s.on).length;
  const anyOn = playing > 0;

  // Global volume: average of active speakers, or 50 if none
  const activeSpeakers = zones.filter(z => z.s.on);
  const globalVol = activeSpeakers.length
    ? Math.round(activeSpeakers.reduce((sum, z) => sum + z.s.vol, 0) / activeSpeakers.length)
    : 50;
  const allMuted = activeSpeakers.length > 0 && activeSpeakers.every(z => z.s.vol === 0);

  const allOn  = () => zones.forEach(z => setD(z.id, { on: true,  vol: z.s.vol || 30 }));
  const allOff = () => zones.forEach(z => setD(z.id, { on: false }));

  const captureGlobalDragBase = () => {
    const actives = zones.filter(z => z.s.on);
    dragBaseVols.current.clear();
    actives.forEach(z => dragBaseVols.current.set(z.id, z.s.vol));
    dragBaseAvg.current = actives.length
      ? actives.reduce((sum, z) => sum + z.s.vol, 0) / actives.length
      : 0;
  };

  const setGlobalVol = (v: number) => {
    const base = dragBaseAvg.current;
    zones.filter(z => z.s.on).forEach(z => {
      const startVol = dragBaseVols.current.get(z.id) ?? z.s.vol;
      const newVol = base > 0
        ? Math.round(Math.min(100, Math.max(0, startVol * (v / base))))
        : v;
      setD(z.id, { vol: newVol });
    });
  };

  const muteAll = () => {
    if (allMuted) {
      // Restore pre-mute volumes
      zones.filter(z => z.s.on).forEach(z => {
        setD(z.id, { vol: preMuteVols.current.get(z.id) ?? 30 });
      });
      preMuteVols.current.clear();
    } else {
      zones.filter(z => z.s.on).forEach(z => {
        preMuteVols.current.set(z.id, z.s.vol);
        setD(z.id, { vol: 0 });
      });
    }
  };

  return (
    <div>
      <LargeTitle title="Music" sub={`${playing} of ${zones.length} playing`}
        right={<Toggle on={anyOn} onChange={(v) => v ? allOn() : allOff()} size={0.9} />}
      />

      {/* Spotify now-playing card */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)',
          background: 'linear-gradient(135deg,#3a2f55,#6a4a7a)',
        }}>
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Album art or placeholder */}
            {displayTrack?.artUrl ? (
              <img src={displayTrack.artUrl} alt="album art"
                style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                <Icon name="speaker" size={26} />
              </div>
            )}
            {/* Track info */}
            <div style={{ flex: 1, minWidth: 0, color: '#fff' }}>
              {spotify.loading && !sdkPlayer.ready ? (
                <div style={{ fontSize: 13, opacity: 0.6 }}>Connecting…</div>
              ) : spotify.error && !sdkPlayer.ready ? (
                <div style={{ fontSize: 13, opacity: 0.6 }}>Spotify unavailable</div>
              ) : displayTrack ? (
                <>
                  <div style={{ fontSize: 15.5, fontWeight: 660, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayTrack.name}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayTrack.artist}
                  </div>
                  {activePlaylist && (
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      ▶ {activePlaylist.name}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>
                    {sdkPlayer.ready ? 'Ready' : 'Nothing playing'}
                  </div>
                  <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 2 }}>
                    {sdkPlayer.ready ? 'Tap a playlist below to begin' : 'Open Spotify on a device to start'}
                  </div>
                </>
              )}
            </div>
            {/* Transport controls */}
            <div style={{ display: 'flex', gap: 8, color: '#fff' }}>
              <button style={miniBtn} onClick={() => spotify.command('prev')}><Icon name="prev" size={20} /></button>
              <button style={{ ...miniBtn, background: 'rgba(255,255,255,0.22)' }}
                onClick={() => spotify.command(displayIsPlaying ? 'pause' : 'play')}>
                <Icon name={displayIsPlaying ? 'pause' : 'play'} size={20} />
              </button>
              <button style={miniBtn} onClick={() => spotify.command('next')}><Icon name="next" size={20} /></button>
              <button style={miniBtn} onClick={() => { void spotify.command('pause'); dismissMini(); }}><Icon name="stop" size={18} /></button>
            </div>
          </div>
          {/* Progress bar */}
          {displayTrack && (
            <div style={{ padding: '0 16px 0' }}>
              <div style={{ position: 'relative', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${(displayProgressMs / displayTrack.durationMs) * 100}%`,
                  background: 'rgba(255,255,255,0.7)', borderRadius: 2, transition: 'width 0.9s linear',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                <span>{fmtMs(displayProgressMs)}</span>
                <span>{fmtMs(displayTrack.durationMs)}</span>
              </div>
            </div>
          )}
          {/* Device selector chip */}
          <div style={{ padding: '10px 16px 14px' }}>
            <button onClick={devicePickerOpen ? () => setDevicePickerOpen(false) : openDevicePicker}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 20,
                padding: '5px 10px 5px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.85)',
                fontSize: 12, fontWeight: 560, WebkitTapHighlightColor: 'transparent',
              }}>
              <Icon name="speaker" size={13} strokeWidth={2} />
              {chipDeviceName}
              <span style={{ transform: devicePickerOpen ? 'rotate(180deg)' : 'none', display: 'inline-flex', transition: 'transform 0.2s' }}>
                <Icon name="chevDown" size={11} strokeWidth={2.5} />
              </span>
            </button>
          </div>
          {/* Device picker dropdown */}
          {devicePickerOpen && (
            <div style={{ margin: '0 12px 14px', borderRadius: 12, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', overflow: 'hidden' }}>
              {devicesLoading ? (
                <div style={{ padding: '12px 14px', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                  Loading devices…
                </div>
              ) : availableDevices.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
                  No devices found
                </div>
              ) : availableDevices.map((d, i) => (
                <button key={d.id} onClick={() => selectDevice(d)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', background: 'transparent', border: 'none',
                  borderTop: i > 0 ? '0.5px solid rgba(255,255,255,0.1)' : 'none',
                  cursor: 'pointer', color: d.isActive ? '#1DB954' : 'rgba(255,255,255,0.9)',
                  fontSize: 13, fontWeight: d.isActive ? 640 : 520, textAlign: 'left',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  <Icon name="speaker" size={15} strokeWidth={d.isActive ? 2.2 : 1.8} />
                  <span style={{ flex: 1 }}>{d.name}</span>
                  {d.isActive && <Icon name="check" size={14} strokeWidth={2.5} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Global volume controls */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle>All Speakers</SectionTitle>
        <Card pad={false} style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={muteAll} style={{ ...iconBtn, color: allMuted ? 'var(--accent)' : 'var(--text2)', background: allMuted ? 'var(--accent)1f' : 'var(--icon-bg)' }}>
              <Icon name={allMuted ? 'mute' : 'volume'} size={20} />
            </button>
            <div style={{ flex: 1 }} onPointerDown={captureGlobalDragBase}>
              <Slider value={allMuted ? 0 : globalVol} onChange={setGlobalVol} height={34} disabled={!anyOn} fill="var(--accent)" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', minWidth: 34, textAlign: 'right' }}>
              {anyOn ? (allMuted ? 'Muted' : `${globalVol}%`) : '–'}
            </span>
          </div>
        </Card>
      </div>

      {/* Per-speaker list */}
      <SectionTitle>Speakers</SectionTitle>
      <Card pad={false} style={{ padding: '6px 14px' }}>
        {zones.map((z, i) => (
          <SpeakerRow key={z.id} zone={z} last={i === zones.length - 1} />
        ))}
      </Card>

      {/* Spotify library */}
      {library.loading ? (
        <div style={{ marginTop: 24, fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>Loading library…</div>
      ) : library.error ? (
        <div style={{ marginTop: 24, fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>{library.error}</div>
      ) : (
        <>
          {/* Playlists */}
          {library.playlists.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <SectionTitle>Playlists</SectionTitle>
              <LibraryGrid>
                {library.playlists.map(pl => (
                  <LibraryCard key={pl.id} uri={pl.uri} name={pl.name} artUrl={pl.artUrl}
                    sub={pl.owner || 'Playlist'} isActive={pl.uri === activePlaylistUri}
                    onPlay={spotify.command} />
                ))}
              </LibraryGrid>
            </div>
          )}
          {/* Followed artists */}
          {library.artists.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <SectionTitle>Artists</SectionTitle>
              <LibraryGrid>
                {library.artists.map(a => (
                  <LibraryCard key={a.id} uri={a.uri} name={a.name} artUrl={a.artUrl}
                    sub={a.genres[0] ?? 'Artist'} artCircle onPlay={spotify.command} />
                ))}
              </LibraryGrid>
            </div>
          )}
          {library.playlists.length === 0 && library.artists.length === 0 && (
            <div style={{ marginTop: 24, fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>
              No playlists or followed artists found.
            </div>
          )}
        </>
      )}
    </div>
  );
}
